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
};

window.CMD = {
    // Main entry point
    execute(raw) {
        raw = (raw || '').trim();
        if (!raw) return [];
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

        // Handle pipe (only support simple `| cat` for now, otherwise ignore)
        // Keep it minimal.

        // Tokenize (naïve — handles single/double quotes)
        const tokens = this.tokenize(cmdStr);
        if (tokens.length === 0) return [];
        const cmd = tokens[0];
        const args = tokens.slice(1);

        // Handle python one-liners specially before dispatch
        const handler = this.handlers[cmd] || this.handlers[this.resolvePath(cmd)];
        let result;
        if (handler) {
            result = handler.call(this, args, cmdStr);
        } else if (cmd.startsWith('/') || cmd.startsWith('./')) {
            result = this.runBinary(cmd, args, cmdStr);
        } else {
            // Check if cmd is in PATH via /tmp (PATH hijack detection happens in run of SUID)
            result = [{ text: t('cmdNotFound', cmd), cls: 'err' }];
        }

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

        // If it's a fake binary in /tmp (created by user for PATH hijack)
        if (node.content && node.content.includes('/bin/sh')) {
            return this.spawnShell(false);
        }

        // /usr/local/bin/status — the SUID PATH-hijack binary in level 4
        if (resolved === '/usr/local/bin/status' && node.suid) {
            return this.runStatusBinary();
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
                { text: '  ls [-la] [path]           list files', cls: 'dim' },
                { text: '  cd <path>                 change directory', cls: 'dim' },
                { text: '  pwd                       print working directory', cls: 'dim' },
                { text: '  cat <file>                display file contents', cls: 'dim' },
                { text: '  find <path> [opts]        find files (supports -perm -4000, -exec)', cls: 'dim' },
                { text: '  whoami / id               user identity', cls: 'dim' },
                { text: '  echo <text> [> file]      print / write text', cls: 'dim' },
                { text: '  chmod <mode> <file>       change permissions', cls: 'dim' },
                { text: '  export VAR=value          set environment variable', cls: 'dim' },
                { text: '  sudo [-l] <cmd>           run as another user', cls: 'dim' },
                { text: '  crontab -l                list user cron jobs', cls: 'dim' },
                { text: '  getcap -r /               list file capabilities', cls: 'dim' },
                { text: '  strings <file>            printable strings in a binary', cls: 'dim' },
                { text: '  python3 -c "<code>"       execute Python one-liner', cls: 'dim' },
                { text: '  vim <file>                edit file (limited support)', cls: 'dim' },
                { text: '  wait                      wait for cron to trigger', cls: 'dim' },
                { text: '  hint / clear / reset / next / lang <en|fr>', cls: 'dim' },
                { text: '', cls: '' }
            ];
        },

        clear() { document.getElementById('termOutput').innerHTML = ''; return []; },

        whoami() { return [{ text: SESSION.user, cls: '' }]; },

        id() {
            if (SESSION.isRoot) return [{ text: 'uid=0(root) gid=0(root) groups=0(root)', cls: '' }];
            return [{ text: 'uid=1000(player) gid=1000(player) groups=1000(player)', cls: '' }];
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
                    return this.spawnShell(true, { via: '/usr/bin/find' });
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

        sudo(args) {
            if (args[0] === '-l') {
                const level = window.GAME.level();
                const entries = level.sudoers?.[SESSION.user] || [];
                if (entries.length === 0) {
                    return [{ text: 'Sorry, user player may not run sudo on ' + SESSION.host + '.', cls: 'err' }];
                }
                const lines = [
                    { text: `Matching Defaults entries for ${SESSION.user} on ${SESSION.host}:`, cls: '' },
                    { text: '    env_reset, mail_badpass', cls: '' },
                    { text: '', cls: '' },
                    { text: `User ${SESSION.user} may run the following commands on ${SESSION.host}:`, cls: '' }
                ];
                for (const e of entries) {
                    const pw = e.nopasswd ? 'NOPASSWD: ' : '';
                    lines.push({ text: `    (${e.runas}) ${pw}${e.cmd}`, cls: 'warn' });
                }
                return lines;
            }
            // sudo <cmd> [args]
            if (args.length === 0) return [{ text: 'usage: sudo [-l] command', cls: 'err' }];
            const level = window.GAME.level();
            const entries = level.sudoers?.[SESSION.user] || [];
            const cmdPath = args[0].startsWith('/') ? args[0] : '/usr/bin/' + args[0];
            const allowed = entries.find(e => e.cmd === cmdPath || e.cmd === args[0]);
            if (!allowed) {
                return [{ text: `Sorry, user ${SESSION.user} is not allowed to execute '${args.join(' ')}' as root.`, cls: 'err' }];
            }
            // Special-case vim escape: sudo vim -c ':!/bin/sh'
            if ((args[0] === 'vim' || args[0] === '/usr/bin/vim')) {
                const joined = args.join(' ');
                if (joined.includes(':!/bin/sh') || joined.includes(':!/bin/bash') || joined.includes(':shell') || joined.includes(':sh')) {
                    return this.spawnShell(true, { via: 'sudo vim' });
                }
                return [
                    { text: '(vim opened as root — type ":!/bin/sh" to escape, or ":q" to quit)', cls: 'dim' },
                    { text: '(simulator: use  sudo vim -c \':!/bin/sh\'  to escape in one command)', cls: 'dim' }
                ];
            }
            return [{ text: `sudo: executed ${args.join(' ')} as root`, cls: 'ok' }];
        },

        python3(args, raw) { return CMD.handlers.python.call(this, args, raw); },
        python(args, raw) {
            // Only support: python3 -c '<code>'
            const cIdx = args.indexOf('-c');
            if (cIdx === -1 || !args[cIdx + 1]) {
                return [{ text: 'Python 3.11.4 (main) [GCC] on linux', cls: '' }, { text: 'Type "help" — this simulator only supports "python3 -c" one-liners.', cls: 'dim' }];
            }
            const code = args.slice(cIdx + 1).join(' ');
            // Detect os.setuid(0) + shell
            const has_setuid = code.includes('setuid(0)') || code.includes('setuid(  0  )'.replace(/ /g,''));
            const has_shell = code.includes('/bin/sh') || code.includes('/bin/bash') || code.includes('os.system') || code.includes('pty.spawn');
            const pyNode = FS.get('/usr/bin/python3');
            const hasCapSetuid = pyNode && pyNode.capabilities && pyNode.capabilities.includes('cap_setuid');
            if (has_setuid && has_shell && hasCapSetuid) {
                return this.spawnShell(true, { via: 'python3 cap_setuid' });
            }
            if (has_setuid && !hasCapSetuid) {
                return [{ text: 'PermissionError: [Errno 1] Operation not permitted', cls: 'err' }];
            }
            return [{ text: '(python code executed — no effect)', cls: 'dim' }];
        },

        vim(args) {
            return [
                { text: '(vim: type ":q" to quit — this simulator only handles the one-shot escape.)', cls: 'dim' },
                { text: '(try:  sudo vim -c \':!/bin/sh\'  if you have sudo rights)', cls: 'dim' }
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
                    lines.push(...this.spawnShell(true, { via: 'cron' }));
                }
                return lines;
            }
            return [{ text: '(no pending cron job)', cls: 'dim' }];
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
    spawnShell(asRoot, meta = {}) {
        if (asRoot) {
            if (SESSION.isRoot) return [{ text: t('alreadyRoot'), cls: 'dim' }];
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

    runStatusBinary() {
        // Level 4: this is a SUID binary that calls `ps` without absolute path.
        // If PATH has /tmp first and /tmp/ps is executable & content triggers shell → root.
        const path = SESSION.env.PATH || '';
        const pathParts = path.split(':');
        for (const p of pathParts) {
            const fakePs = FS.get(p + '/ps');
            if (fakePs && p !== '/usr/bin' && p !== '/bin' && p !== '/sbin' && p !== '/usr/sbin') {
                const content = fakePs.content || '';
                if (content.includes('/bin/sh') || content.includes('/bin/bash')) {
                    return this.spawnShell(true, { via: 'PATH hijack on /usr/local/bin/status' });
                }
            }
        }
        // Otherwise, run legitimate ps
        return [
            { text: '=== status v1.2 ===', cls: 'info' },
            { text: 'System status:', cls: 'dim' },
            { text: 'USER       PID  CMD', cls: 'dim' },
            { text: 'root         1  /sbin/init', cls: '' },
            { text: 'root       231  /usr/sbin/cron', cls: '' },
            { text: 'player    1442  -bash', cls: '' },
            { text: 'player    1501  ps -eo user,pid,cmd', cls: '' }
        ];
    }
};

// ── Handle redirection during echo ──
// Intercept echo for redirect capture. Simpler: rely on the generic redirect logic in execute().

// ── Override redirect handling to also detect cron hijack ──
const _origRunOne = window.CMD.runOne.bind(window.CMD);
window.CMD.runOne = function(input) {
    // Pre-check: if writing to /opt/backup.sh in level 2 while not root, mark cron pending
    const level = window.GAME.level();
    const redirMatch = input.match(/^(.*?)\s*(>>|>)\s*(\S+)\s*$/);
    if (redirMatch && level.id === 2) {
        const target = FS.normalize(redirMatch[3]);
        if (target === '/opt/backup.sh' && !SESSION.isRoot) {
            const payload = redirMatch[1].trim();
            const result = _origRunOne(input);
            // Mark cron as pending
            SESSION.pendingCron = true;
            SESSION.cronPayload = payload;
            return [
                ...result,
                { text: t('cronWaiting'), cls: 'warn' }
            ];
        }
    }
    return _origRunOne(input);
};
