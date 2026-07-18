// Command interpreter. Parses raw input, executes actions on FS/session.
// Returns array of {text, cls} lines to print.

window.SESSION = {
    user: 'player',
    host: 'box-01',
    cwd: '/home/player',
    prevCwd: null, // for `cd -`
    env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
    isRoot: false,
    hintIndex: 0,
    tmpBins: {}, // { name: content } for PATH-hijack fake binaries in /tmp
    pendingCron: false,
    cronPayload: null,
    cmdCount: 0,   // commands typed this machine (for the victory scorecard)
    startTime: 0,  // Date.now() when the machine was loaded
    blueTeam: false, // in the post-root "harden the box" phase
    sudoAuthed: false, // has `sudo -l` already prompted+cached a password this machine (real sudo tickets)
    nfsMount: null, // exported path currently mounted via `mount -t nfs` (box-23), or null
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
        // Blue-team hardening: once the fix command lands, confirm the box is closed.
        if (SESSION.blueTeam) {
            const level = window.GAME.level();
            if (this.checkHardened(level)) {
                SESSION.blueTeam = false;
                if (window.GAME && window.GAME.markHardened) window.GAME.markHardened(level);
                out.push({ text: '', cls: '' });
                out.push({ text: t('blueTeamDone'), cls: 'ok' });
                if (window.SFX) window.SFX.win();
            }
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
            if (!this.canRedirectTarget(target)) return [{ text: t('permDenied', redirect.target), cls: 'err' }];
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
            if (!this.canRedirectTarget(target)) return [{ text: t('permDenied', redirect.target), cls: 'err' }];
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
    // Unknown stages pass the lines through unchanged. `sudo <stage>` is also
    // recognised here (needed for `... | sudo tee -a <file>`, box-20's vector).
    applyFilter(stageStr, lines) {
        const tokens = this.tokenize(stageStr);
        if (tokens.length === 0) return lines;
        let name = tokens[0];
        let rest = tokens.slice(1);
        let viaSudo = false;
        if (name === 'sudo' && rest.length) { viaSudo = true; name = rest[0]; rest = rest.slice(1); }
        const args = rest.filter(a => a !== '-');
        if (name === 'tee') return this.teeFilter(args, lines, viaSudo);
        const FILTERS = ['grep', 'egrep', 'wc', 'head', 'tail', 'sort', 'uniq', 'cat'];
        if (FILTERS.includes(name)) return this._filter(name, args, lines);
        return lines; // not a filter — leave the stream untouched
    },

    // `tee [-a] FILE...` — writes the piped-in stream to one or more files (and
    // echoes it back). Outside sudo, normal write permissions apply. Under sudo
    // (box-20), the write happens as root regardless of the target's own mode —
    // exactly like a real `sudo tee -a /etc/passwd` GTFOBins escape.
    teeFilter(args, lines, viaSudo) {
        const append = args.includes('-a');
        const targets = args.filter(a => !a.startsWith('-'));
        if (!targets.length) return lines; // no target — tee just mirrors stdin
        const content = lines.map(l => l.text).join('\n') + (lines.length ? '\n' : '');
        const level = window.GAME.level();
        for (const raw of targets) {
            const target = FS.normalize(raw);
            if (viaSudo) {
                const entries = this.sudoEntries(level);
                const allowed = entries.some(e => e.cmd === '/usr/bin/tee' || e.cmd === 'tee' || e.cmd === 'ALL');
                if (!allowed) return [{ text: `sudo: user ${SESSION.user} is not allowed to execute 'tee ${raw}' as root.`, cls: 'err' }];
            } else if (!this.canRedirectTarget(target)) {
                return [{ text: t('permDenied', raw), cls: 'err' }];
            }
            if (append) FS.appendFile(target, content); else FS.writeFile(target, content);
        }
        return lines;
    },

    // Can the current session write this path via a plain `>`/`>>` redirect or
    // tee? New files go through canCreateIn (parent dir's own permissions);
    // existing files are checked against FS.canWrite so a locked-down file
    // (box-20's /etc/passwd) genuinely resists a non-privileged write. A path
    // under an active `mount -t nfs` (box-23, no_root_squash) always succeeds —
    // the export's own Unix perms don't apply once mounted.
    canRedirectTarget(path) {
        if (this.isNfsWritable(path)) return true;
        const node = FS.get(path);
        if (!node) return this.canCreateIn(path);
        if (SESSION.isRoot) return true;
        return FS.canWrite(path);
    },

    // Is this path inside the currently-mounted NFS export? no_root_squash
    // means the client's own root UID maps straight onto the server for that
    // export, so writes through the mount bypass the target's local Unix
    // permissions entirely — box-23's vector (see levels.js `nfsExports`).
    isNfsWritable(path) {
        return !!SESSION.nfsMount && (path === SESSION.nfsMount || path.startsWith(SESSION.nfsMount + '/'));
    },

    // Can a *new* file be created at this path? Mirrors FS.canWrite's rules
    // (owner, world-writable, /tmp's sticky bit) but keyed off the parent
    // directory, since the target node doesn't exist yet to check directly.
    canCreateIn(path) {
        if (SESSION.isRoot || this.isNfsWritable(path)) return true;
        const parent = FS.parent(path);
        if (parent === '/tmp') return true;
        const parentNode = FS.get(parent);
        if (!parentNode || parentNode.type !== 'dir') return false;
        if (parentNode.owner === SESSION.user) return true;
        return parentNode.mode === '777' || !!parentNode.writable_by_all;
    },

    // Files written through an active nfsMount land owned by root
    // (no_root_squash); anywhere else, ownership is the current user, as usual.
    creationOwner(path) {
        return this.isNfsWritable(path) ? 'root' : SESSION.user;
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
            // /etc/ld.so.preload: any SUID binary loads the libs it lists. If the
            // level declares this vector and the preload points at a real lib → root.
            if ((window.GAME.level().wins || []).some(w => w.type === 'ld_so_preload')) {
                const pre = FS.get('/etc/ld.so.preload');
                const libs = ((pre && pre.content) || '').split(/\s+/).filter(Boolean);
                if (libs.some(l => FS.get(FS.normalize(l)))) {
                    return this.spawnShell(true, { via: 'ld.so.preload → ' + FS.basename(resolved), type: 'ld_so_preload' });
                }
            }
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

        man(args) {
            const name = args[0];
            if (!name) return [{ text: 'What manual page do you want? (usage: man <command>)', cls: 'dim' }];
            const m = CMD.MANPAGES[name];
            if (!m) return [{ text: `No manual entry for ${name}`, cls: 'err' }];
            const lang = window.currentLang === 'fr' ? 'fr' : 'en';
            const out = [
                { text: `${name.toUpperCase()}(1)`, cls: 'ok' },
                { text: 'NAME', cls: 'info' },
                { text: `    ${name} — ${m.d[lang] || m.d.en}`, cls: '' },
                { text: 'SYNOPSIS', cls: 'info' },
                { text: `    ${m.s}`, cls: 'dim' }
            ];
            if (m.e) out.push({ text: 'EXAMPLE', cls: 'info' }, { text: `    ${m.e}`, cls: 'dim' });
            out.push({ text: '', cls: '' });
            return out;
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
            let target = args[0] || '/home/player';       // no arg → home
            if (target === '-') target = SESSION.prevCwd || SESSION.cwd; // previous dir
            const n = FS.normalize(target);
            const node = FS.get(n);
            if (!node) return [{ text: t('noSuchFile', target), cls: 'err' }];
            if (node.type !== 'dir') return [{ text: t('notDirectory', target), cls: 'err' }];
            SESSION.prevCwd = SESSION.cwd;
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
            const nfsBypass = this.isNfsWritable(n);
            if (!nfsBypass && !FS.canWrite(n) && node.owner !== SESSION.user && !SESSION.isRoot) {
                return [{ text: t('permDenied', file), cls: 'err' }];
            }
            // Handle +x, +s / -s (drop SUID), or numeric
            if (mode.includes('+x')) node.mode = (node.mode || '644').slice(0, -1) + '5';
            else if (/-s/.test(mode)) {   // u-s, a-s, g-s → remove SUID (blue-team fix)
                node.suid = false;
                node.mode = (node.mode && node.mode.length === 4) ? node.mode.slice(1) : (node.mode || '755');
            }
            else if (mode.includes('+s')) {
                node.mode = '4' + (node.mode || '755');
                node.suid = true;
                // no_root_squash: a setuid file the mount let us plant, already
                // owned by root, is a live root shell the instant it runs —
                // declare the exploit so runBinary() fires this box's win.
                if (nfsBypass && node.owner === 'root') node.exploit = 'nfs_no_root_squash';
            }
            else if (/^\d{3,4}$/.test(mode)) {
                node.mode = mode;
                node.suid = (mode.length === 4 && mode.startsWith('4'));
                // Tightening the "other" write bit closes world-writability.
                const others = parseInt(mode[mode.length - 1], 10);
                if (!(others & 2)) node.writable_by_all = false;
            }
            return [];
        },

        setcap(args) {
            // setcap -r FILE  → drop capabilities (blue-team fix); setcap CAP FILE → set
            if (args[0] === '-r' && args[1]) {
                const node = FS.get(FS.normalize(args[1]));
                if (!node) return [{ text: t('noSuchFile', args[1]), cls: 'err' }];
                delete node.capabilities;
                return [];
            }
            if (args.length >= 2) {
                const node = FS.get(FS.normalize(args[args.length - 1]));
                if (!node) return [{ text: t('noSuchFile', args[args.length - 1]), cls: 'err' }];
                node.capabilities = args.slice(0, -1).join(' ');
                return [];
            }
            return [{ text: 'usage: setcap -r FILE | setcap CAP+ep FILE', cls: 'err' }];
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
        mount(args) {
            if (args[0] === '-t' && args[1] === 'nfs') {
                const spec = args[2];
                const dest = args[3];
                if (!spec || !dest) return [{ text: 'usage: mount -t nfs host:/export /mountpoint', cls: 'dim' }];
                const colon = spec.indexOf(':');
                const exportPath = FS.normalize(colon >= 0 ? spec.slice(colon + 1) : spec);
                const level = window.GAME.level();
                const exp = (level.nfsExports || []).find(e => e.path === exportPath);
                if (!exp) {
                    return [{ text: `mount.nfs: mounting ${spec} failed, reason given by server: No such file or directory`, cls: 'err' }];
                }
                const mp = FS.normalize(dest);
                const mpNode = FS.get(mp);
                if (!mpNode || mpNode.type !== 'dir') {
                    return [{ text: `mount point ${dest} does not exist`, cls: 'err' }];
                }
                SESSION.nfsMount = exportPath;
                return []; // mount is silent on success
            }
            if (args.length) return [{ text: `mount: unknown filesystem type '${args.join(' ')}'`, cls: 'err' }];
            return [
                { text: 'sysfs on /sys type sysfs (rw,nosuid,nodev,noexec,relatime)', cls: 'dim' },
                { text: 'proc on /proc type proc (rw,nosuid,nodev,noexec,relatime)', cls: 'dim' },
                { text: '/dev/sda1 on / type ext4 (rw,relatime,errors=remount-ro)', cls: '' },
                { text: 'tmpfs on /tmp type tmpfs (rw,nosuid,nodev)', cls: '' },
            ];
        },

        showmount(args) {
            const level = window.GAME.level();
            const exports = level.nfsExports || [];
            const eIdx = args.indexOf('-e');
            const host = (eIdx >= 0 && args[eIdx + 1]) ? args[eIdx + 1] : SESSION.host;
            if (!exports.length) return [{ text: 'clnt_create: RPC: Program not registered', cls: 'err' }];
            const lines = [{ text: `Export list for ${host}:`, cls: '' }];
            for (const e of exports) lines.push({ text: `${e.path.padEnd(24)} ${e.clients || '*'}`, cls: 'warn' });
            return lines;
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
            const errors = [];
            for (const a of args) {
                if (a.startsWith('-')) continue;
                const n = FS.normalize(a);
                if (!FS.get(n)) {
                    if (!this.canCreateIn(n)) { errors.push({ text: t('permDenied', a), cls: 'err' }); continue; }
                    FS.createFile(n, '', this.creationOwner(n));
                }
            }
            return errors;
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
                const entries = this.sudoEntries(level);
                // Real sudo asks for the *invoking user's own* password before -l will
                // even disclose rights, then caches a ticket for the rest of the
                // session — regardless of which individual commands end up NOPASSWD.
                // Simulated here as a one-off flavor line rather than a real prompt
                // (nothing blocks on it — the point is the immersion, not a gate).
                const authLine = !SESSION.sudoAuthed
                    ? [{ text: `[sudo] password for ${SESSION.user}: `, cls: 'dim' }]
                    : [];
                SESSION.sudoAuthed = true;
                if (entries.length === 0) {
                    return [...authLine, { text: 'Sorry, user player may not run sudo on ' + SESSION.host + '.', cls: 'err' }];
                }
                const envKeep = (level.env_keep && level.env_keep.length) ? ', env_keep+="' + level.env_keep.join(' ') + '"' : '';
                const lines = [
                    ...authLine,
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
            const entries = this.sudoEntries(level);

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

            // LD_LIBRARY_PATH abuse (box-22): unlike LD_PRELOAD, this only works if
            // the vulnerable binary is actually missing a library that the dynamic
            // linker then finds by searching the hijacked directory — so the planted
            // .so has to be named *exactly* what the binary looks for, not just any
            // shared object. That name is declared per-level as `vulnLib`.
            if (envAssigns.LD_LIBRARY_PATH !== undefined) {
                const libPathOk = (level.env_keep || []).includes('LD_LIBRARY_PATH');
                if (!libPathOk) return [{ text: 'sudo: LD_LIBRARY_PATH not preserved (not in env_keep) — ignored', cls: 'dim' }];
                if (!level.vulnLib) return [{ text: 'sudo: LD_LIBRARY_PATH preserved, but nothing here loads a hijackable library', cls: 'dim' }];
                const dir = FS.normalize(envAssigns.LD_LIBRARY_PATH);
                const planted = FS.get(dir + '/' + level.vulnLib);
                if (planted && entries.length) {
                    return this.spawnShell(true, { via: 'sudo LD_LIBRARY_PATH=' + envAssigns.LD_LIBRARY_PATH, type: 'ld_library_path' });
                }
                if (!planted) return [{ text: `sudo: executed ${cmdArgs.join(' ')} as root (dynamic linker found no ${level.vulnLib} in ${envAssigns.LD_LIBRARY_PATH} — nothing hijacked)`, cls: 'dim' }];
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
                // classic writable-/etc/passwd attack: an injected UID-0 line),
                // or if the real hash has already been cracked (box-21).
                if (pwField === '') {
                    return this.spawnShell(true, { via: 'su ' + target, type: 'passwd_write' });
                }
                if (SESSION.shadowCracked && this.winConditionMet('shadow_crack')) {
                    return this.spawnShell(true, { via: 'su root (cracked hash)', type: 'shadow_crack' });
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
            const pyNode = FS.get('/usr/bin/python3');
            // Detect os.setuid(0) + shell
            const has_setuid = code.includes('setuid(0)') || code.includes('setuid(  0  )'.replace(/ /g,''));
            const has_shell = code.includes('/bin/sh') || code.includes('/bin/bash') || code.includes('os.system') || code.includes('pty.spawn');
            const hasCapSetuid = pyNode && pyNode.capabilities && pyNode.capabilities.includes('cap_setuid');
            if (has_setuid && has_shell && hasCapSetuid) {
                return this.spawnShell(true, { via: 'python3 cap_setuid', type: 'python_setuid' });
            }
            if (has_setuid && !hasCapSetuid) {
                return [{ text: 'PermissionError: [Errno 1] Operation not permitted', cls: 'err' }];
            }
            // cap_dac_read_search+ep bypasses discretionary read/traversal checks
            // entirely — a Python one-liner can open() any file on the box, root-owned
            // or not (box-21). Real GTFOBins lists this for cat/tar/python/etc.
            const hasCapDac = pyNode && pyNode.capabilities && (pyNode.capabilities.includes('cap_dac_read_search') || pyNode.capabilities.includes('cap_dac_override'));
            const openMatch = code.match(/open\((['"])(.*?)\1/);
            if (openMatch && code.includes('.read()')) {
                const target = FS.normalize(openMatch[2]);
                const node = FS.get(target);
                if (!node) return [{ text: `FileNotFoundError: [Errno 2] No such file or directory: '${openMatch[2]}'`, cls: 'err' }];
                if (node.type === 'dir') return [{ text: `IsADirectoryError: [Errno 21] Is a directory: '${openMatch[2]}'`, cls: 'err' }];
                if (!hasCapDac && !FS.canRead(target)) {
                    return [{ text: `PermissionError: [Errno 13] Permission denied: '${openMatch[2]}'`, cls: 'err' }];
                }
                const content = node.content || '';
                if (hasCapDac && !FS.canRead(target)) {
                    // Stash a readable copy so downstream tools (john) can pick it up
                    // without re-deriving the bypass — mirrors piping python's stdout
                    // into a file in a real terminal.
                    FS.writeFile('/tmp/shadow.copy', content);
                    SESSION.shadowRead = true;
                }
                return content.split('\n').filter((l, i, arr) => !(i === arr.length - 1 && l === '')).map(l => ({ text: l, cls: '' }));
            }
            return [{ text: t('pyNoEffect'), cls: 'dim' }];
        },

        // GTFOBins-adjacent "cracking" step for box-21 — deliberately simulated,
        // not a real hash-cracking implementation. Requires having exfiltrated
        // /etc/shadow's content first (via the cap_dac_read_search bypass above).
        john(args) {
            const target = args.find(a => !a.startsWith('-'));
            if (!target) return [{ text: 'Usage: john [OPTIONS] [PASSWORD-FILES]', cls: 'dim' }];
            const node = FS.get(FS.normalize(target));
            if (!node) return [{ text: `john: can't open file ${target}: No such file or directory`, cls: 'err' }];
            if (!SESSION.shadowRead) {
                return [{ text: 'john: no password hashes loaded — read /etc/shadow first', cls: 'err' }];
            }
            const level = window.GAME.level();
            if (!level.crackedPassword) {
                return [{ text: 'john: no cracking rule configured for this file', cls: 'err' }];
            }
            SESSION.shadowCracked = true;
            return [
                { text: 'Loaded 1 password hash (sha512crypt, crypt(3) $6$ [SHA512 128/128 AVX 2x])', cls: 'dim' },
                { text: 'Press \'q\' or Ctrl-C to abort, almost any other key for status', cls: 'dim' },
                { text: `${level.crackedPassword}   (root)`, cls: 'ok' },
                { text: '1g 0:00:00:02 100% 2/3 (ETA: now)  0.4132g/s 1024p/s 1024c/s 1024C/s', cls: 'dim' },
                { text: 'Use the "--show" option to display all of the cracked passwords reliably', cls: 'dim' }
            ];
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

    // In-game manual pages (d = bilingual description, s = synopsis, e = example).
    MANPAGES: {
        ls:     { d: { en: 'list directory contents', fr: 'lister le contenu d\'un dossier' }, s: 'ls [-la] [path]', e: 'ls -la /etc' },
        cd:     { d: { en: 'change the working directory', fr: 'changer de dossier courant' }, s: 'cd [dir | - ]', e: 'cd /tmp ; cd -' },
        cat:    { d: { en: 'print file contents', fr: 'afficher le contenu d\'un fichier' }, s: 'cat <file>...', e: 'cat /etc/passwd' },
        find:   { d: { en: 'search the filesystem; -perm -4000 finds SUID', fr: 'chercher dans le FS ; -perm -4000 trouve les SUID' }, s: 'find <path> [-perm -4000] [-exec cmd \\;]', e: 'find / -perm -4000 2>/dev/null' },
        chmod:  { d: { en: 'change permissions; u-s drops the SUID bit', fr: 'changer les permissions ; u-s retire le SUID' }, s: 'chmod <mode|u-s|+x> <file>', e: 'chmod u-s /usr/bin/find' },
        getcap: { d: { en: 'list file capabilities', fr: 'lister les capabilities des fichiers' }, s: 'getcap -r <path>', e: 'getcap -r / 2>/dev/null' },
        setcap: { d: { en: 'set or (-r) remove file capabilities', fr: 'définir ou (-r) retirer les capabilities' }, s: 'setcap -r <file>', e: 'setcap -r /usr/bin/python3' },
        sudo:   { d: { en: 'run a command as another user; -l lists your rights', fr: 'exécuter en tant qu\'autre user ; -l liste tes droits' }, s: 'sudo [-l] [VAR=val] <cmd>', e: 'sudo -l' },
        su:     { d: { en: 'switch user (root if the account has no password)', fr: 'changer d\'utilisateur (root si le compte n\'a pas de mot de passe)' }, s: 'su <user>', e: 'su root' },
        ssh:    { d: { en: 'connect over SSH, optionally with a key', fr: 'se connecter en SSH, éventuellement avec une clé' }, s: 'ssh [-i keyfile] user@host', e: 'ssh -i id_rsa root@localhost' },
        gcc:    { d: { en: 'compile C source into a binary/shared object', fr: 'compiler du C en binaire/objet partagé' }, s: 'gcc [-shared -fPIC] -o <out> <src.c>', e: 'gcc -shared -fPIC -o /tmp/x.so /tmp/x.c' },
        touch:  { d: { en: 'create an empty file (./ prefix avoids option parsing)', fr: 'créer un fichier vide (préfixe ./ pour éviter l\'analyse d\'options)' }, s: 'touch <file>', e: "touch ./--checkpoint=1" },
        echo:   { d: { en: 'print text; redirect with > or >>', fr: 'afficher du texte ; rediriger avec > ou >>' }, s: 'echo <text> [> file]', e: "echo 'hi' > /tmp/f" },
        export: { d: { en: 'set an environment variable', fr: 'définir une variable d\'environnement' }, s: 'export VAR=value', e: 'export PATH=/tmp:$PATH' },
        python3:{ d: { en: 'run a Python one-liner', fr: 'exécuter un one-liner Python' }, s: "python3 -c '<code>'", e: "python3 -c 'import os; os.setuid(0); os.system(\"/bin/sh\")'" },
        tee:    { d: { en: 'copy stdin to a file (and stdout); -a appends', fr: 'copier stdin vers un fichier (et stdout) ; -a pour ajouter' }, s: 'tee [-a] <file>', e: "echo hi | sudo tee -a /etc/passwd" },
        john:   { d: { en: 'crack password hashes offline (simulated)', fr: 'casser des hachages de mot de passe hors-ligne (simulé)' }, s: 'john <hashfile>', e: 'john /tmp/shadow.copy' },
        grep:   { d: { en: 'filter lines matching a pattern', fr: 'filtrer les lignes correspondant à un motif' }, s: 'grep [-ivc] <pattern> <file>', e: 'cat /etc/passwd | grep -v nologin' },
        ps:     { d: { en: 'report running processes', fr: 'lister les processus en cours' }, s: 'ps [aux]', e: 'ps aux | grep root' },
        docker: { d: { en: 'control containers; docker group ~= root', fr: 'gérer des conteneurs ; groupe docker ~= root' }, s: 'docker run -v /:/mnt ...', e: 'docker run -v /:/mnt -it alpine chroot /mnt sh' },
        showmount: { d: { en: 'list NFS exports offered by a host', fr: 'lister les partages NFS exposés par un hôte' }, s: 'showmount -e [host]', e: 'showmount -e' },
        mount:  { d: { en: 'mount a filesystem, e.g. an NFS export', fr: 'monter un système de fichiers, ex. un partage NFS' }, s: 'mount -t nfs host:/export /mountpoint', e: 'mount -t nfs localhost:/srv/backups /mnt' },
        crontab:{ d: { en: 'list cron jobs (see also /etc/crontab)', fr: 'lister les tâches cron (voir aussi /etc/crontab)' }, s: 'crontab -l', e: 'cat /etc/crontab' },
        wait:   { d: { en: 'wait for a scheduled cron job to fire', fr: 'attendre le déclenchement d\'un job cron' }, s: 'wait', e: 'wait' },
        man:    { d: { en: 'show this manual for a command', fr: 'afficher ce manuel pour une commande' }, s: 'man <command>', e: 'man sudo' }
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

    // Blue-team: has the player's fix actually closed the declared vulnerability?
    checkHardened(level) {
        const h = level && level.harden;
        if (!h) return false;
        const node = FS.get(FS.normalize(h.target));
        if (!node) return false;
        switch (h.type) {
            case 'unset_suid': return !node.suid;
            case 'unset_cap': return !node.capabilities;
            case 'lock_perms': {
                const others = parseInt((node.mode || '000').slice(-1), 10);
                return !node.writable_by_all && !(others & 2);
            }
            default: return false;
        }
    },

    // Effective sudo rules for the current user: the level's static sudoers plus
    // any rule the player dropped into a writable /etc/sudoers.d (box-14).
    sudoEntries(level) {
        const entries = [...(level.sudoers?.[SESSION.user] || [])];
        const dropDir = FS.get('/etc/sudoers.d');
        if (dropDir && Array.isArray(dropDir.children)) {
            for (const name of dropDir.children) {
                const f = FS.get('/etc/sudoers.d/' + name);
                ((f && f.content) || '').split('\n').forEach(line => {
                    const mm = line.match(/^\s*(%?\w+)\s+ALL\s*=\s*\([^)]*\)\s*(NOPASSWD:\s*)?(.+?)\s*$/);
                    if (mm && (mm[1] === SESSION.user || mm[1] === '%' + SESSION.user)) {
                        entries.push({ cmd: mm[3] === 'ALL' ? 'ALL' : mm[3], nopasswd: !!mm[2], runas: 'root' });
                    }
                });
            }
        }
        return entries;
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
            if (window.SFX) window.SFX.win();
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
