// Command interpreter. Parses raw input, executes actions on FS/session.
// Returns array of {text, cls} lines to print.

window.SESSION = {
    user: 'player',
    host: 'box-01',
    cwd: '/home/player',
    env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
    isRoot: false,
    hintIndex: 0,
    tmpBins: {}, // { name: content } for PATH-hijack fake binaries in /tmp
    pendingCron: false,
    cronPayload: null,
    cmdCount: 0,   // commands typed this machine (for the victory scorecard)
    startTime: 0,  // Date.now() when the machine was loaded
};

window.CMD = {
    // Main entry point
    execute(raw) {
        raw = (raw || '').trim();
        if (!raw) return [];
        SESSION.cmdCount++;
        // Strip shell noise that we don't emulate
        raw = raw.replace(/\s*2>\s*\/dev\/null/g, '')
                 .replace(/\s*>\s*\/dev\/null/g, ' ');
        const out = [];
        // Only split on && (avoid breaking `\;` in find -exec)
        const chunks = raw.split(/\s*&&\s*/).filter(Boolean);
        for (const chunk of chunks) {
            const lines = this.runOne(chunk);
            if (lines) out.push(...lines);
        }
        return out;
    },

    runOne(input) {
        // Handle redirection > and >> — require whitespace before > to avoid catching "2>/dev/null"
        let redirect = null;
        let cmdStr = input;
        const redirMatch = input.match(/^(.*?)\s+(>>|>)\s+(\S+)\s*$/);
        if (redirMatch) {
            cmdStr = redirMatch[1];
            redirect = { op: redirMatch[2], target: redirMatch[3] };
        }

        // Pipeline: cmd1 | cmd2 | cmd3 (quote-aware). A single stage is the common
        // case and behaves exactly like before.
        const stages = this.splitPipes(cmdStr);
        let result = stages.length > 1 ? this.runPipeline(stages) : this.dispatch(stages[0] ?? cmdStr);

        // Apply redirect
        if (redirect && result && result._captured !== undefined) {
            const content = result._captured;
            const target = FS.normalize(redirect.target);
            if (redirect.op === '>') {
                FS.writeFile(target, content);
            } else {
                FS.appendFile(target, content);
            }
            return result.suppress ? [] : (result.lines || []);
        } else if (redirect && Array.isArray(result)) {
            // Capture text output from lines
            const captured = result.map(l => l.text).join('\n') + '\n';
            const target = FS.normalize(redirect.target);
            if (redirect.op === '>') {
                FS.writeFile(target, captured);
            } else {
                FS.appendFile(target, captured);
            }
            return [];
        }

        return Array.isArray(result) ? result : (result?.lines || []);
    },

    // Dispatch a single (pipe-free) command string to its handler.
    dispatch(cmdStr) {
        const tokens = this.tokenize(cmdStr);
        if (tokens.length === 0) return [];
        const cmd = tokens[0];
        const args = tokens.slice(1);
        const handler = this.handlers[cmd] || this.handlers[this.resolvePath(cmd)];
        if (handler) return handler.call(this, args, cmdStr);
        if (cmd.startsWith('/') || cmd.startsWith('./')) return this.runBinary(cmd, args, cmdStr);
        return [{ text: t('cmdNotFound', cmd), cls: 'err' }];
    },

    // Quote-aware split on `|` (keeps quotes so the tokenizer strips them later).
    splitPipes(str) {
        const parts = [];
        let cur = '', inS = false, inD = false;
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (c === "'" && !inD) { inS = !inS; cur += c; continue; }
            if (c === '"' && !inS) { inD = !inD; cur += c; continue; }
            if (c === '|' && !inS && !inD) { parts.push(cur); cur = ''; continue; }
            cur += c;
        }
        parts.push(cur);
        return parts.map(s => s.trim()).filter(Boolean);
    },

    // Run stage 0 normally, then thread each subsequent stage as a filter over
    // the previous stage's output lines.
    runPipeline(stages) {
        let result = this.dispatch(stages[0]);
        let lines = Array.isArray(result) ? result : (result?.lines || []);
        for (let i = 1; i < stages.length; i++) {
            lines = this.applyFilter(stages[i], lines);
        }
        return lines;
    },

    // Apply a filter stage (grep/wc/head/tail/sort/cat) to piped-in lines.
    // Unknown stages pass the lines through unchanged.
    applyFilter(stageStr, lines) {
        const tokens = this.tokenize(stageStr);
        if (tokens.length === 0) return lines;
        const name = tokens[0];
        const args = tokens.slice(1).filter(a => a !== '-');
        const FILTERS = ['grep', 'egrep', 'wc', 'head', 'tail', 'sort', 'uniq', 'cat'];
        if (FILTERS.includes(name)) return this._filter(name, args, lines);
        return lines; // not a filter — leave the stream untouched
    },

    // Shared text-stream operators, used by both pipelines and the standalone
    // grep/head/tail/wc/sort handlers.
    _filter(name, args, lines) {
        const flags = args.filter(a => a.startsWith('-'));
        const rest = args.filter(a => !a.startsWith('-'));
        const has = (f) => flags.some(x => x.includes(f.replace('-', '')));
        switch (name) {
            case 'grep': case 'egrep': {
                const pattern = rest[0] || '';
                const ci = has('i');
                const inv = has('v');
                let rx;
                try { rx = new RegExp(pattern, ci ? 'i' : ''); }
                catch { rx = { test: (s) => (ci ? s.toLowerCase().includes(pattern.toLowerCase()) : s.includes(pattern)) }; }
                let out = lines.filter(l => rx.test(l.text) !== inv);
                if (has('c')) return [{ text: String(out.length) }];
                return out.length ? out : [];
            }
            case 'wc': {
                const text = lines.map(l => l.text).join('\n');
                const nl = lines.length;
                if (has('l')) return [{ text: String(nl) }];
                const words = text.split(/\s+/).filter(Boolean).length;
                const chars = text.length + (nl ? 1 : 0);
                return [{ text: `${String(nl).padStart(7)} ${String(words).padStart(7)} ${String(chars).padStart(7)}` }];
            }
            case 'head': {
                const n = parseInt(rest[0] || flags.find(f => /^-\d+$/.test(f))?.slice(1) || '10', 10);
                return lines.slice(0, n);
            }
            case 'tail': {
                const n = parseInt(rest[0] || flags.find(f => /^-\d+$/.test(f))?.slice(1) || '10', 10);
                return lines.slice(-n);
            }
            case 'sort': {
                let out = [...lines].sort((a, b) => a.text.localeCompare(b.text));
                if (has('r')) out.reverse();
                if (has('u')) {
                    const seen = new Set();
                    out = out.filter(l => (seen.has(l.text) ? false : seen.add(l.text)));
                }
                return out;
            }
            case 'uniq': {
                const out = [];
                for (const l of lines) if (!out.length || out[out.length - 1].text !== l.text) out.push(l);
                return out;
            }
            case 'cat':
            default:
                return lines;
        }
    },

    // Read one or more files into a line stream (for standalone text filters).
    _linesFromFiles(files) {
        const lines = [];
        for (const f of files) {
            const node = FS.get(FS.normalize(f));
            if (!node) { lines.push({ text: t('noSuchFile', f), cls: 'err' }); continue; }
            if (node.type === 'dir') { lines.push({ text: t('isDirectory', f), cls: 'err' }); continue; }
            (node.content || '').split('\n').forEach((line, i, arr) => {
                if (i === arr.length - 1 && line === '') return;
                lines.push({ text: line });
            });
        }
        return lines;
    },

    tokenize(str) {
        const tokens = [];
        let cur = '';
        let inSingle = false, inDouble = false;
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (c === "'" && !inDouble) { inSingle = !inSingle; continue; }
            if (c === '"' && !inSingle) { inDouble = !inDouble; continue; }
            if (c === '\\' && i + 1 < str.length) { cur += str[i + 1]; i++; continue; }
            if (/\s/.test(c) && !inSingle && !inDouble) {
                if (cur) { tokens.push(cur); cur = ''; }
                continue;
            }
            cur += c;
        }
        if (cur) tokens.push(cur);
        return tokens;
    },

    resolvePath(cmd) {
        if (cmd.startsWith('/') || cmd.startsWith('./')) return cmd;
        return null;
    },

    runBinary(path, args, raw) {
        const resolved = FS.normalize(path);
        const node = FS.get(resolved);
        if (!node) return [{ text: t('noSuchFile', path), cls: 'err' }];
        if (node.type === 'dir') return [{ text: t('isDirectory', path), cls: 'err' }];

        // Self-contained exploit binary (e.g. simulated kernel PoC). The fs node
        // declares `exploit: '<win-type>'`; running it fires that win directly.
        if (node.exploit) {
            return this.spawnShell(true, { via: FS.basename(resolved), type: node.exploit });
        }

        // If it's a fake binary in /tmp (created by user for PATH hijack)
        if (node.content && node.content.includes('/bin/sh')) {
            return this.spawnShell(false);
        }

        // SUID helper that shells out to an unqualified command → PATH-hijack surface.
        // The fs node declares `calls_unqualified: '<cmd>'`; no hard-coded path.
        if (node.suid && node.calls_unqualified) {
            return this.runSuidHelper(resolved, node);
        }

        // Generic SUID binary being invoked directly
        if (node.suid) {
            return [{ text: '[status] system uptime: 3d 04h 12m; load: 0.34 0.22 0.19', cls: 'dim' }];
        }

        return [{ text: `${path}: cannot execute (simulated binary)`, cls: 'dim' }];
    },

    // ── Handlers ────────────────────────────────────────────────
    handlers: {
        help(args) {
            return [
                { text: t('helpHeader'), cls: 'ok' },
                ...(t('helpCommands') || []).map(line => ({ text: line, cls: 'dim' }))
            ];
        },

        clear() { document.getElementById('termOutput').innerHTML = ''; return []; },

        whoami() { return [{ text: SESSION.user, cls: '' }]; },

        id() {
            if (SESSION.isRoot) return [{ text: 'uid=0(root) gid=0(root) groups=0(root)', cls: '' }];
            const lvl = window.GAME.level();
            const inDocker = (lvl.wins || []).some(w => w.type === 'docker_sock') && SESSION.user === 'player';
            const uid = SESSION.user === 'player' ? 1000 : 1001;
            let groups = `${uid}(${SESSION.user})`;
            if (inDocker) groups += ',999(docker)';
            return [{ text: `uid=${uid}(${SESSION.user}) gid=${uid}(${SESSION.user}) groups=${groups}`, cls: inDocker ? 'warn' : '' }];
        },

        pwd() { return [{ text: SESSION.cwd, cls: '' }]; },

        ls(args) {
            let long = false, all = false;
            let target = SESSION.cwd;
            for (const a of args) {
                if (a.startsWith('-')) {
                    if (a.includes('l')) long = true;
                    if (a.includes('a')) all = true;
                } else {
                    target = a;
                }
            }
            const listing = FS.listDir(target);
            if (!listing) {
                // Maybe it's a file
                const node = FS.get(target);
                if (node && node.type === 'file') {
                    if (long) return [{ text: `${FS.formatMode(node)} 1 ${node.owner} ${node.owner}     ${(node.content||'').length}  ${FS.basename(target)}`, cls: '' }];
                    return [{ text: FS.basename(target), cls: '' }];
                }
                return [{ text: t('noSuchFile', target), cls: 'err' }];
            }
            const items = all ? [
                { name: '.', ...FS.get(FS.normalize(target)) },
                { name: '..', ...(FS.get(FS.parent(FS.normalize(target))) || FS.get('/')) },
                ...listing
            ] : listing.filter(l => !l.name.startsWith('.'));
            if (long) {
                return items.map(item => {
                    const size = item.type === 'dir' ? 4096 : ((item.content || '').length || 8192);
                    const nameCls = item.type === 'dir' ? 'info' : (item.suid ? 'flag' : '');
                    return { text: `${FS.formatMode(item)} 1 ${item.owner || 'root'} ${item.owner || 'root'}\t${String(size).padStart(6)}  ${item.name}`, cls: nameCls };
                });
            }
            return [{ text: items.map(i => i.name).join('  '), cls: '' }];
        },

        cd(args) {
            const target = args[0] || '/home/player';
            const n = FS.normalize(target);
            const node = FS.get(n);
            if (!node) return [{ text: t('noSuchFile', target), cls: 'err' }];
            if (node.type !== 'dir') return [{ text: t('notDirectory', target), cls: 'err' }];
            SESSION.cwd = n;
            return [];
        },

        cat(args) {
            if (args.length === 0) return [{ text: t('missingOp', 'cat'), cls: 'err' }];
            const out = [];
            for (const a of args) {
                const n = FS.normalize(a);
                const node = FS.get(n);
                if (!node) { out.push({ text: t('noSuchFile', a), cls: 'err' }); continue; }
                if (node.type === 'dir') { out.push({ text: t('isDirectory', a), cls: 'err' }); continue; }
                if (!FS.canRead(n)) { out.push({ text: t('permDenied', a), cls: 'err' }); continue; }
                const content = node.content || '';
                content.split('\n').forEach((line, i, arr) => {
                    if (i === arr.length - 1 && line === '') return;
                    out.push({ text: line, cls: n.includes('flag') && line.includes('flag{') ? 'flag' : '' });
                });
            }
            return out;
        },

        echo(args) {
            // Support: echo "text" — support quoted args via tokenizer already
            const text = args.join(' ');
            return [{ text }];
        },

        find(args) {
            // Support:
            // find <path> -perm -4000 [2>/dev/null]
            // find <path> -exec /bin/sh \;   (or -exec /bin/sh -p \;)
            let searchPath = '/';
            const opts = [];
            for (let i = 0; i < args.length; i++) {
                if (args[i].startsWith('-') || args[i] === '2>/dev/null') opts.push(args[i]);
                else if (i === 0) searchPath = args[i];
                else opts.push(args[i]);
            }
            const optStr = opts.join(' ');

            // Detect exec-based SUID escape
            if (optStr.includes('-exec') && (optStr.includes('/bin/sh') || optStr.includes('/bin/bash'))) {
                // Requires SUID find in current level (level 1)
                const findNode = FS.get('/usr/bin/find');
                if (findNode && findNode.suid) {
                    return this.spawnShell(true, { via: '/usr/bin/find', type: 'suid_shell_via' });
                }
                return [{ text: '(no SUID on find — normal shell)', cls: 'dim' }];
            }

            if (optStr.includes('-perm -4000') || optStr.includes('-perm /4000') || optStr.includes('-perm +4000')) {
                // List all SUID files in fs
                const results = [];
                for (const [path, node] of Object.entries(FS._tree)) {
                    if (node.suid) results.push({ text: path, cls: 'warn' });
                }
                return results.length ? results : [{ text: '', cls: '' }];
            }

            // Default: walk the fs
            const results = [];
            const walk = (dir) => {
                const list = FS.listDir(dir);
                if (!list) return;
                for (const item of list) {
                    results.push({ text: item.path });
                    if (item.type === 'dir') walk(item.path);
                }
            };
            walk(FS.normalize(searchPath));
            return results;
        },

        getcap(args) {
            // getcap -r / 2>/dev/null
            const results = [];
            for (const [path, node] of Object.entries(FS._tree)) {
                if (node.capabilities) {
                    results.push({ text: `${path} = ${node.capabilities}`, cls: 'warn' });
                }
            }
            return results.length ? results : [{ text: '', cls: '' }];
        },

        crontab(args) {
            if (args.includes('-l')) {
                return [{ text: 'no crontab for ' + SESSION.user, cls: 'dim' }];
            }
            return [{ text: 'usage: crontab -l | -e', cls: 'dim' }];
        },

        chmod(args) {
            if (args.length < 2) return [{ text: t('missingOp', 'chmod'), cls: 'err' }];
            const mode = args[0];
            const file = args[1];
            const n = FS.normalize(file);
            const node = FS.get(n);
            if (!node) return [{ text: t('noSuchFile', file), cls: 'err' }];
            if (!FS.canWrite(n) && node.owner !== SESSION.user && !SESSION.isRoot) {
                return [{ text: t('permDenied', file), cls: 'err' }];
            }
            // Handle +x, +s, or numeric
            if (mode.includes('+x')) node.mode = (node.mode || '644').slice(0, -1) + '5';
            else if (mode.includes('+s')) { node.mode = '4' + (node.mode || '755'); node.suid = true; }
            else if (/^\d{3,4}$/.test(mode)) {
                node.mode = mode;
                if (mode.length === 4 && mode.startsWith('4')) node.suid = true;
            }
            return [];
        },

        export(args) {
            for (const a of args) {
                const m = a.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
                if (m) SESSION.env[m[1]] = m[2].replace(/\$PATH/g, SESSION.env.PATH || '');
            }
            return [];
        },

        strings(args) {
            if (args.length === 0) return [{ text: t('missingOp', 'strings'), cls: 'err' }];
            const n = FS.normalize(args[0]);
            const node = FS.get(n);
            if (!node) return [{ text: t('noSuchFile', args[0]), cls: 'err' }];
            const c = node.content || '';
            return c.split('\n').filter(l => l.length > 0).map(l => ({ text: l }));
        },

        // ── Text-stream filters (also usable at the start of a pipeline) ──
        grep(args) {
            const flags = args.filter(a => a.startsWith('-'));
            const rest = args.filter(a => !a.startsWith('-'));
            const pattern = rest[0];
            const files = rest.slice(1);
            if (pattern === undefined || files.length === 0) return [{ text: 'usage: grep [-iv] PATTERN FILE...', cls: 'err' }];
            return this._filter('grep', [...flags, pattern], this._linesFromFiles(files));
        },
        head(args) {
            let n = 10; const files = [];
            for (let i = 0; i < args.length; i++) {
                const a = args[i];
                if (a === '-n') n = parseInt(args[++i] || '10', 10);
                else if (/^-\d+$/.test(a)) n = parseInt(a.slice(1), 10);
                else if (!a.startsWith('-')) files.push(a);
            }
            return this._linesFromFiles(files).slice(0, n);
        },
        tail(args) {
            let n = 10; const files = [];
            for (let i = 0; i < args.length; i++) {
                const a = args[i];
                if (a === '-n') n = parseInt(args[++i] || '10', 10);
                else if (/^-\d+$/.test(a)) n = parseInt(a.slice(1), 10);
                else if (!a.startsWith('-')) files.push(a);
            }
            return this._linesFromFiles(files).slice(-n);
        },
        wc(args) {
            const flags = args.filter(a => a.startsWith('-'));
            const files = args.filter(a => !a.startsWith('-'));
            if (files.length === 0) return [{ text: 'usage: wc [-l] FILE...', cls: 'err' }];
            return this._filter('wc', flags, this._linesFromFiles(files));
        },
        sort(args) {
            const flags = args.filter(a => a.startsWith('-'));
            const files = args.filter(a => !a.startsWith('-'));
            return this._filter('sort', flags, this._linesFromFiles(files));
        },
        uniq(args) {
            const files = args.filter(a => !a.startsWith('-'));
            return this._filter('uniq', [], this._linesFromFiles(files));
        },

        // ── Enumeration commands (authentic tool output — locale-neutral) ──
        ps(args) {
            const joined = args.join(' ');
            if (/aux|-ef|-e/.test(joined)) {
                return [
                    { text: 'USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND', cls: 'dim' },
                    { text: 'root         1  0.0  0.1 168300 11208 ?        Ss   09:12   0:01 /sbin/init', cls: '' },
                    { text: 'root       231  0.0  0.0  25976  4884 ?        Ss   09:12   0:00 /usr/sbin/cron -f', cls: '' },
                    { text: 'root       402  0.0  0.2  72304  6720 ?        Ss   09:12   0:00 /usr/sbin/sshd -D', cls: '' },
                    { text: `${(SESSION.user + '   ').slice(0, 8)} 1442  0.0  0.0  21532  5312 pts/0    Ss   09:20   0:00 -bash`, cls: '' },
                    { text: `${(SESSION.user + '   ').slice(0, 8)} 1650  0.0  0.0  19100  3288 pts/0    R+   09:21   0:00 ps ${joined}`.trimEnd(), cls: '' },
                ];
            }
            return [
                { text: '  PID TTY          TIME CMD', cls: 'dim' },
                { text: ' 1442 pts/0    00:00:00 bash', cls: '' },
                { text: ' 1650 pts/0    00:00:00 ps', cls: '' },
            ];
        },
        env() {
            const home = SESSION.user === 'root' ? '/root' : '/home/' + SESSION.user;
            const lines = Object.entries(SESSION.env).map(([k, v]) => ({ text: `${k}=${v}` }));
            lines.push({ text: `USER=${SESSION.user}` });
            lines.push({ text: `HOME=${home}` });
            lines.push({ text: `SHELL=/bin/bash` });
            lines.push({ text: `PWD=${SESSION.cwd}` });
            lines.push({ text: `TERM=xterm-256color` });
            return lines;
        },
        uname(args) {
            const a = args.join(' ');
            const p = { s: 'Linux', n: SESSION.host, r: '5.4.0-42-generic', v: '#46-Ubuntu SMP Fri Jul 10 00:24:02 UTC 2020', m: 'x86_64', o: 'GNU/Linux' };
            if (a.includes('-a')) return [{ text: `${p.s} ${p.n} ${p.r} ${p.v} ${p.m} ${p.m} ${p.m} ${p.o}` }];
            if (a.includes('-r')) return [{ text: p.r }];
            if (a.includes('-m')) return [{ text: p.m }];
            if (a.includes('-n')) return [{ text: p.n }];
            return [{ text: p.s }];
        },
        hostname() { return [{ text: SESSION.host }]; },
        which(args) {
            const dirs = (SESSION.env.PATH || '').split(':');
            const out = [];
            for (const name of args) {
                if (name.startsWith('-')) continue;
                for (const d of dirs) {
                    if (FS.get(d + '/' + name)) { out.push({ text: d + '/' + name }); break; }
                }
            }
            return out;
        },
        file(args) {
            if (args.length === 0) return [{ text: 'usage: file FILE...', cls: 'err' }];
            return args.map(a => {
                const node = FS.get(FS.normalize(a));
                if (!node) return { text: `${a}: cannot open '${a}' (No such file or directory)`, cls: 'err' };
                if (node.type === 'dir') return { text: `${a}: directory` };
                const c = node.content || '';
                if (c.startsWith('ELF')) return { text: `${a}: ELF 64-bit LSB ${node.suid ? 'executable (setuid)' : 'executable'}, x86-64, dynamically linked` };
                if (c.includes('unix socket')) return { text: `${a}: socket` };
                if (c.startsWith('#!')) return { text: `${a}: POSIX shell script, ASCII text executable` };
                return { text: `${a}: ASCII text` };
            });
        },
        history() {
            const h = (window.TERM && window.TERM.history) || [];
            return h.map((c, i) => ({ text: `${String(i + 1).padStart(5)}  ${c}` }));
        },
        mount() {
            return [
                { text: 'sysfs on /sys type sysfs (rw,nosuid,nodev,noexec,relatime)', cls: 'dim' },
                { text: 'proc on /proc type proc (rw,nosuid,nodev,noexec,relatime)', cls: 'dim' },
                { text: '/dev/sda1 on / type ext4 (rw,relatime,errors=remount-ro)', cls: '' },
                { text: 'tmpfs on /tmp type tmpfs (rw,nosuid,nodev)', cls: '' },
            ];
        },

        // ── Build / file-creation tools used by the newer boxes ──
        gcc(args) {
            let out = 'a.out';
            const srcs = [];
            for (let i = 0; i < args.length; i++) {
                if (args[i] === '-o') { out = args[++i] || 'a.out'; continue; }
                if (args[i].startsWith('-')) continue;
                srcs.push(args[i]);
            }
            for (const s of srcs) {
                if (!FS.get(FS.normalize(s))) return [{ text: `gcc: error: ${s}: No such file or directory`, cls: 'err' }];
            }
            if (!srcs.length) return [{ text: 'gcc: fatal error: no input files\ncompilation terminated.', cls: 'err' }];
            FS.writeFile(FS.normalize(out), 'ELF 64-bit LSB shared object, x86-64 (compiled payload)');
            return []; // gcc is silent on success
        },
        cc(args) { return CMD.handlers.gcc.call(this, args); },

        touch(args) {
            for (const a of args) {
                if (a.startsWith('-')) continue;
                const n = FS.normalize(a);
                if (!FS.get(n)) FS.createFile(n, '');
            }
            return [];
        },

        ssh(args) {
            const level = window.GAME.level();
            let key = null, target = null;
            for (let i = 0; i < args.length; i++) {
                if (args[i] === '-i') { key = args[++i]; continue; }
                if (args[i].startsWith('-')) continue;
                if (!target) target = args[i];
            }
            if (!target) return [{ text: 'usage: ssh [-i keyfile] user@host', cls: 'dim' }];
            const user = target.includes('@') ? target.split('@')[0] : SESSION.user;
            const host = target.includes('@') ? target.split('@')[1] : target;
            const sshWin = (level.wins || []).find(w => w.type === 'ssh_key');
            if (key) {
                const keyNode = FS.get(FS.normalize(key));
                if (!keyNode) return [{ text: `Warning: Identity file ${key} not accessible: No such file or directory.`, cls: 'err' }];
                const readable = FS.canRead(FS.normalize(key));
                const isPriv = (keyNode.content || '').includes('PRIVATE KEY');
                if (user === 'root' && readable && isPriv && sshWin) {
                    return this.spawnShell(true, { via: `ssh -i ${FS.basename(key)} root@${host}`, type: 'ssh_key' });
                }
                if (user === 'root' && (!readable || !isPriv)) {
                    return [{ text: `root@${host}: Permission denied (publickey).`, cls: 'err' }];
                }
            }
            return [{ text: `${user}@${host}: Permission denied (publickey,password).`, cls: 'err' }];
        },

        sudo(args) {
            if (args[0] === '-l') {
                const level = window.GAME.level();
                const entries = level.sudoers?.[SESSION.user] || [];
                if (entries.length === 0) {
                    return [{ text: 'Sorry, user player may not run sudo on ' + SESSION.host + '.', cls: 'err' }];
                }
                const envKeep = (level.env_keep && level.env_keep.length) ? ', env_keep+="' + level.env_keep.join(' ') + '"' : '';
                const lines = [
                    { text: `Matching Defaults entries for ${SESSION.user} on ${SESSION.host}:`, cls: '' },
                    { text: '    env_reset, mail_badpass' + envKeep, cls: envKeep ? 'warn' : '' },
                    { text: '', cls: '' },
                    { text: `User ${SESSION.user} may run the following commands on ${SESSION.host}:`, cls: '' }
                ];
                for (const e of entries) {
                    const pw = e.nopasswd ? 'NOPASSWD: ' : '';
                    lines.push({ text: `    (${e.runas}) ${pw}${e.cmd}`, cls: 'warn' });
                }
                return lines;
            }
            // sudo [VAR=value ...] <cmd> [args]
            if (args.length === 0) return [{ text: 'usage: sudo [-l] command', cls: 'err' }];
            const level = window.GAME.level();
            const entries = level.sudoers?.[SESSION.user] || [];

            // Capture leading VAR=value tokens (environment passed through sudo).
            const envAssigns = {};
            let ai = 0;
            while (ai < args.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(args[ai])) {
                const eq = args[ai].indexOf('=');
                envAssigns[args[ai].slice(0, eq)] = args[ai].slice(eq + 1);
                ai++;
            }
            const cmdArgs = args.slice(ai);

            // LD_PRELOAD abuse: sudoers kept LD_PRELOAD in env_keep, and the user can
            // sudo *something*, so a malicious shared object runs as root.
            if (envAssigns.LD_PRELOAD !== undefined) {
                const preloadOk = (level.env_keep || []).includes('LD_PRELOAD');
                const soNode = FS.get(FS.normalize(envAssigns.LD_PRELOAD));
                if (preloadOk && soNode && entries.length) {
                    return this.spawnShell(true, { via: 'sudo LD_PRELOAD=' + FS.basename(envAssigns.LD_PRELOAD), type: 'ld_preload' });
                }
                if (!preloadOk) return [{ text: 'sudo: LD_PRELOAD not preserved (not in env_keep) — ignored', cls: 'dim' }];
                if (!soNode) return [{ text: `sudo: cannot preload '${envAssigns.LD_PRELOAD}': No such file or directory`, cls: 'err' }];
            }

            if (cmdArgs.length === 0) return [{ text: 'usage: sudo [-l] command', cls: 'err' }];
            const cmdPath = cmdArgs[0].startsWith('/') ? cmdArgs[0] : '/usr/bin/' + cmdArgs[0];
            const allowed = entries.find(e => e.cmd === cmdPath || e.cmd === cmdArgs[0] || e.cmd === 'ALL');
            if (!allowed) {
                return [{ text: `Sorry, user ${SESSION.user} is not allowed to execute '${cmdArgs.join(' ')}' as root.`, cls: 'err' }];
            }
            // Generic GTFOBins-style shell escape. The type granted is whatever sudo
            // win the level declares, so both sudo_vim_escape (box-05) and the newer
            // generic sudo_shell boxes are driven from data, not hard-coded here.
            const binBase = FS.basename(allowed.cmd === 'ALL' ? cmdArgs[0] : allowed.cmd);
            const joined = cmdArgs.join(' ');
            if (this.sudoEscapes(binBase, joined)) {
                const sudoWin = (level.wins || []).find(w => w.type === 'sudo_vim_escape' || w.type === 'sudo_shell');
                return this.spawnShell(true, { via: 'sudo ' + binBase, type: sudoWin ? sudoWin.type : 'sudo_shell' });
            }
            // Allowed, but no shell-escape attempted yet — nudge for interactive editors.
            if (binBase === 'vim' || binBase === 'vi') {
                return [
                    { text: t('vimRootNudge1'), cls: 'dim' },
                    { text: t('vimRootNudge2'), cls: 'dim' }
                ];
            }
            return [{ text: `sudo: executed ${cmdArgs.join(' ')} as root`, cls: 'ok' }];
        },

        su(args) {
            let target = args[0];
            if (target === '-' || target === '-l' || target === '--login') target = args[1];
            if (!target) target = 'root';
            const passwd = FS.get('/etc/passwd');
            const line = (passwd?.content || '').split('\n').find(l => l.split(':')[0] === target);
            if (!line) return [{ text: `su: user ${target} does not exist`, cls: 'err' }];
            const fields = line.split(':');
            const uid = fields[2];
            const pwField = fields[1];
            if (uid === '0') {
                // Becoming root only works if the account has NO password (the
                // classic writable-/etc/passwd attack: an injected UID-0 line).
                if (pwField === '') {
                    return this.spawnShell(true, { via: 'su ' + target, type: 'passwd_write' });
                }
                return [{ text: 'su: Authentication failure', cls: 'err' }];
            }
            // Lateral move to another non-root account (creds recovered by enumeration).
            SESSION.user = target;
            const home = '/home/' + target;
            if (FS.get(home)) SESSION.cwd = home;
            window.updatePrompt();
            return [
                { text: t('suSwitched', target), cls: 'ok' },
                { text: t('suEnumerate'), cls: 'dim' }
            ];
        },

        docker(args) {
            const joined = args.join(' ');
            if (args[0] === 'run' && (joined.includes('/:/') || /-v\s+\/:\S*/.test(joined))) {
                const win = (window.GAME.level().wins || []).find(w => w.type === 'docker_sock');
                if (win) return this.spawnShell(true, { via: 'docker run -v /:/mnt', type: 'docker_sock' });
                return [{ text: 'docker: permission denied while trying to connect to the Docker daemon socket', cls: 'err' }];
            }
            if (args[0] === 'ps') return [{ text: 'CONTAINER ID   IMAGE   COMMAND   STATUS   NAMES', cls: 'dim' }];
            if (args[0] === 'images') return [
                { text: 'REPOSITORY   TAG      IMAGE ID       SIZE', cls: 'dim' },
                { text: 'alpine       latest   c059bfaa849c   7.4MB', cls: '' }
            ];
            return [{ text: "docker: try  docker run -v /:/mnt -it alpine chroot /mnt sh", cls: 'dim' }];
        },

        python3(args, raw) { return CMD.handlers.python.call(this, args, raw); },
        python(args, raw) {
            // Only support: python3 -c '<code>'
            const cIdx = args.indexOf('-c');
            if (cIdx === -1 || !args[cIdx + 1]) {
                return [{ text: 'Python 3.11.4 (main) [GCC] on linux', cls: '' }, { text: t('simOnlyPython'), cls: 'dim' }];
            }
            const code = args.slice(cIdx + 1).join(' ');
            // Detect os.setuid(0) + shell
            const has_setuid = code.includes('setuid(0)') || code.includes('setuid(  0  )'.replace(/ /g,''));
            const has_shell = code.includes('/bin/sh') || code.includes('/bin/bash') || code.includes('os.system') || code.includes('pty.spawn');
            const pyNode = FS.get('/usr/bin/python3');
            const hasCapSetuid = pyNode && pyNode.capabilities && pyNode.capabilities.includes('cap_setuid');
            if (has_setuid && has_shell && hasCapSetuid) {
                return this.spawnShell(true, { via: 'python3 cap_setuid', type: 'python_setuid' });
            }
            if (has_setuid && !hasCapSetuid) {
                return [{ text: 'PermissionError: [Errno 1] Operation not permitted', cls: 'err' }];
            }
            return [{ text: t('pyNoEffect'), cls: 'dim' }];
        },

        vim(args) {
            return [
                { text: t('vimQuitNudge1'), cls: 'dim' },
                { text: t('vimQuitNudge2'), cls: 'dim' }
            ];
        },

        wait() {
            if (SESSION.pendingCron && SESSION.cronPayload) {
                SESSION.pendingCron = false;
                const lines = [
                    { text: '', cls: '' },
                    { text: t('cronFired'), cls: 'ok' },
                    { text: `# executed: ${SESSION.cronPayload}`, cls: 'dim' }
                ];
                // Check payload effect
                const p = SESSION.cronPayload;
                if (p.includes('chmod +s') || p.includes('chmod 4755') || p.includes('/bin/sh') || p.includes('/bin/bash')) {
                    lines.push({ text: '', cls: '' });
                    // Grant root
                    lines.push(...this.spawnShell(true, { via: 'cron', type: 'cron_hijack' }));
                }
                return lines;
            }

            // Wildcard-injection cron (tar --checkpoint-action). If the target dir now
            // holds a crafted option-filename pointing at a real script, tar runs it as root.
            const wtar = (window.GAME.level().wins || []).find(w => w.type === 'wildcard_tar');
            if (wtar) {
                const listing = FS.listDir(wtar.dir) || [];
                const action = listing.find(f => f.name.startsWith('--checkpoint-action='));
                if (action) {
                    const execPart = (action.name.split('exec=')[1] || '').trim();
                    const scriptName = execPart.replace(/^(sh|bash)\s+/, '').replace(/^\.\//, '').trim();
                    const scriptNode = scriptName && (FS.get(FS.normalize(wtar.dir + '/' + scriptName)) || FS.get(FS.normalize(scriptName)));
                    if (scriptNode) {
                        return [
                            { text: '', cls: '' },
                            { text: t('wildcardFired'), cls: 'ok' },
                            { text: t('wildcardExplain', action.name, scriptName), cls: 'dim' },
                            { text: '', cls: '' },
                            ...this.spawnShell(true, { via: 'wildcard injection (tar --checkpoint-action)', type: 'wildcard_tar' })
                        ];
                    }
                    return [{ text: t('wildcardNoScript'), cls: 'dim' }];
                }
                return [{ text: t('wildcardCraft'), cls: 'dim' }];
            }
            return [{ text: t('noPendingCron'), cls: 'dim' }];
        },

        hint() { return window.GAME.giveHint(); },
        next() { return window.GAME.nextLevel(); },
        reset() { window.GAME.reset(); return []; },

        lang(args) {
            const l = args[0];
            if (l === 'en' || l === 'fr') {
                window.setLanguage(l);
                return [{ text: `Language set to ${l.toUpperCase()}`, cls: 'ok' }];
            }
            return [{ text: 'usage: lang <en|fr>', cls: 'err' }];
        },

        exit() {
            if (SESSION.isRoot) {
                SESSION.isRoot = false;
                SESSION.user = 'player';
                document.body.classList.remove('is-root');
                window.updatePrompt();
                return [{ text: 'exit (back to player)', cls: 'dim' }];
            }
            return [{ text: 'logout', cls: 'dim' }];
        },
    },

    // ── Special routines ────────────────────────────────────────
    // Win conditions are declared per-level in levels.js (`wins: [{ type, ... }]`).
    // spawnShell(true, { type }) checks against that declared list before granting
    // root, so a level's data is the actual source of truth — not just documentation.
    winConditionMet(type) {
        if (!type) return true; // no declared type to check against (legacy/manual call)
        const wins = window.GAME.level().wins || [];
        return wins.some(w => w.type === type);
    },

    // Known one-shot GTFOBins escapes for `sudo <bin>`. Returns true if the given
    // invocation would drop a root shell.
    sudoEscapes(bin, joined) {
        switch (bin) {
            case 'vim': case 'vi':
                return /:!\/bin\/(sh|bash)|:!sh|:shell/.test(joined);
            case 'awk': case 'gawk':
                return joined.includes('system(') && /\/bin\/(sh|bash)/.test(joined);
            case 'env':
                return /\/bin\/(sh|bash)/.test(joined);
            case 'find':
                return joined.includes('-exec') && /\/bin\/(sh|bash)/.test(joined);
            case 'python': case 'python3': case 'perl': case 'ruby':
                return /os\.system|pty\.spawn|exec|system\(/.test(joined);
            case 'less': case 'more': case 'man':
                return joined.includes('!/bin/sh') || joined.includes('!sh');
            case 'bash': case 'sh': case 'dash':
                return true; // running a shell itself as root == root
            default:
                return false;
        }
    },

    spawnShell(asRoot, meta = {}) {
        if (asRoot) {
            if (SESSION.isRoot) return [{ text: t('alreadyRoot'), cls: 'dim' }];
            if (!this.winConditionMet(meta.type)) {
                // The exploit fired but doesn't match this machine's declared win
                // condition — treat as a no-op rather than silently granting root.
                return [{ text: t('exploitInvalid'), cls: 'dim' }];
            }
            SESSION.isRoot = true;
            SESSION.user = 'root';
            document.body.classList.add('is-root');
            window.updatePrompt();
            const via = meta.via ? ` (via ${meta.via})` : '';
            const lines = [
                { text: '# ' + t('rootObtained') + via, cls: 'ok' },
                { text: '# id', cls: 'dim' },
                { text: 'uid=0(root) gid=0(root) groups=0(root)', cls: '' },
                { text: '# cat /root/flag.txt', cls: 'dim' },
                { text: window.GAME.level().flag, cls: 'flag' },
                { text: t('rootWelcome'), cls: 'ok' }
            ];
            // Trigger win modal shortly after
            setTimeout(() => window.GAME.win(), 400);
            return lines;
        }
        return [{ text: '$ /bin/sh spawned (still as ' + SESSION.user + ')', cls: 'dim' }];
    },

    // A SUID helper that shells out to an unqualified command (declared on the fs
    // node as `calls_unqualified`). If a writable dir earlier in PATH holds a fake
    // version of that command whose payload spawns a shell → root. Fully generic:
    // any level can add a PATH-hijack box just with data.
    runSuidHelper(binPath, node) {
        const cmd = node.calls_unqualified;
        const trusted = ['/usr/local/sbin', '/usr/local/bin', '/usr/sbin', '/usr/bin', '/sbin', '/bin'];
        const pathParts = (SESSION.env.PATH || '').split(':');
        for (const p of pathParts) {
            if (trusted.includes(p)) continue;
            const fake = FS.get(p + '/' + cmd);
            if (fake) {
                const content = fake.content || '';
                if (content.includes('/bin/sh') || content.includes('/bin/bash')) {
                    return this.spawnShell(true, { via: `PATH hijack on ${binPath}`, type: 'path_hijack' });
                }
            }
        }
        // Otherwise, run the legitimate command output.
        return [
            { text: '=== status v1.2 ===', cls: 'info' },
            { text: 'System status:', cls: 'dim' },
            { text: 'USER       PID  CMD', cls: 'dim' },
            { text: 'root         1  /sbin/init', cls: '' },
            { text: 'root       231  /usr/sbin/cron', cls: '' },
            { text: 'player    1442  -bash', cls: '' },
            { text: `player    1501  ${cmd}`, cls: '' }
        ];
    }
};

// ── Handle redirection during echo ──
// Intercept echo for redirect capture. Simpler: rely on the generic redirect logic in execute().

// ── Cron-hijack hook (data-driven, no hard-coded level id / path) ──
// If the current level declares a `cron_hijack` win, writing to the script path it
// names arms the pending cron job. Any future cron box works with data alone.
const _origRunOne = window.CMD.runOne.bind(window.CMD);
window.CMD.runOne = function(input) {
    const level = window.GAME.level();
    const cronWin = (level.wins || []).find(w => w.type === 'cron_hijack');
    if (cronWin && cronWin.path && !SESSION.isRoot) {
        const redirMatch = input.match(/^(.*?)\s*(>>|>)\s*(\S+)\s*$/);
        if (redirMatch) {
            const target = FS.normalize(redirMatch[3]);
            if (target === FS.normalize(cronWin.path)) {
                const payload = redirMatch[1].trim();
                const result = _origRunOne(input);
                SESSION.pendingCron = true;
                SESSION.cronPayload = payload;
                return [
                    ...result,
                    { text: t('cronWaiting'), cls: 'warn' }
                ];
            }
        }
    }
    return _origRunOne(input);
};
