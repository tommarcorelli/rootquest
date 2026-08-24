// rogue.js — "Rogue" mode (🎲): a machine you have never seen before.
//
// The lab's 38 boxes have one weakness as training material: once you've
// solved a box, you've solved it. Replaying it tests your memory, not your
// enumeration. Rogue mode builds a box on the spot from a seed — vulnerability
// class, paths, binary names, decoys and hostname all derived from that seed —
// so the first thing you have to do is the thing the game is actually about:
// find out what's wrong with this host.
//
// The seed is the whole state. Same seed, same box, on any machine, forever —
// which makes runs comparable and shareable ("try seed a3f19c") without any
// server. Generation goes through BOXBUILDER's existing templates and comes
// out as normal box JSON, so it lands in GAME_CUSTOM.import() with the same
// validation every hand-written custom box gets. Nothing here is a special
// case at play time: a rogue box is just a box.
window.ROGUE = {
    // ── Seeded RNG ──────────────────────────────────────────────────────
    // mulberry32: 32-bit, no dependencies, well-distributed enough for
    // picking from short lists and identical across every JS engine —
    // which is the property that makes a shared seed mean anything.
    rng(seed) {
        let a = seed >>> 0;
        return function() {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    // Seeds are shown and typed as short hex strings — easier to read out
    // loud than a ten-digit number, and it keeps the shareable form compact.
    parseSeed(text) {
        const s = String(text || '').trim().toLowerCase().replace(/^0x/, '');
        if (/^[0-9a-f]{1,8}$/.test(s)) return parseInt(s, 16) >>> 0;
        // Anything else is hashed, so "monday" is a perfectly valid seed.
        let h = 2166136261 >>> 0;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h >>> 0;
    },

    formatSeed(seed) { return (seed >>> 0).toString(16).padStart(6, '0'); },

    randomSeed() {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0;
        }
        return Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
    },

    // ── Word lists the generator draws from ─────────────────────────────
    HOSTS: ['relay', 'vault', 'nimbus', 'granite', 'harbor', 'cinder', 'lantern', 'quarry', 'basalt', 'ferrite', 'meridian', 'tundra'],
    SUFFIX: ['ops', 'core', 'edge', 'lab', 'node', 'srv'],
    SUID_BINS: ['/usr/local/bin/backup-tool', '/usr/local/bin/diskcheck', '/opt/tools/sysreport', '/usr/local/sbin/netprobe', '/opt/agent/collector'],
    CRON_SCRIPTS: ['/opt/scripts/rotate-logs.sh', '/usr/local/bin/nightly-sync.sh', '/opt/tasks/cleanup.sh', '/srv/jobs/healthcheck.sh'],
    // Falls back to the nine originals if the GTFOBins table hasn't loaded,
    // but normally draws from the full ingested set — every one of which the
    // escape engine recognises, so every pick yields a solvable box.
    SUDO_BINS: ['find', 'awk', 'env', 'python3', 'perl', 'node', 'nice', 'less', 'vim'],
    sudoBins() {
        return (window.GTFOBINS && window.GTFOBINS.bins().length) ? window.GTFOBINS.bins() : this.SUDO_BINS;
    },
    HIJACK_CMDS: ['tar', 'gzip', 'date', 'ps', 'df'],
    HELPERS: ['/usr/local/bin/diskusage', '/opt/tools/quota-report', '/usr/local/bin/svc-status'],

    // Decoys: plausible files that lead nowhere. A generated box without them
    // gives itself away — the only interesting file is the vulnerable one.
    DECOYS: [
        { path: '/opt/README', content: 'Deployment notes. Contact ops@internal before changing anything here.\n' },
        { path: '/var/log/sync.log', content: 'sync ok\nsync ok\nsync ok\n' },
        { path: '/home/player/notes.txt', content: 'reminder: rotate the API token before the audit\n' },
        { path: '/etc/motd', content: 'Authorised access only. All sessions are recorded.\n' },
        { path: '/opt/config.yml', content: 'retention: 30d\nverbose: false\n' },
        { path: '/home/player/.bash_history', content: 'ls -la\ncd /opt\ncat README\n' },
        { path: '/var/backups/db.sql.gz', content: 'gzip data' },
        { path: '/srv/www/index.html', content: '<h1>It works</h1>\n' }
    ],

    // Template ids and how hard the resulting box tends to be, used only for
    // the tier label (which drives the time-attack budget, if that's on).
    CLASSES: [
        { tpl: 'suid_misuse', diff: 'EASY' },
        { tpl: 'cron_hijack', diff: 'MEDIUM' },
        { tpl: 'passwd_writable', diff: 'EASY' },
        { tpl: 'sudo_gtfobin', diff: 'MEDIUM' },
        { tpl: 'path_hijack', diff: 'HARD' }
    ],

    // ── Generation ──────────────────────────────────────────────────────
    // Pure: same seed in, identical box object out, no DOM and no globals
    // beyond BOXBUILDER's templates. That's what makes it testable and what
    // makes a shared seed trustworthy.
    build(seed) {
        const rnd = this.rng(seed);
        const pick = (list) => list[Math.floor(rnd() * list.length) % list.length];

        const cls = pick(this.CLASSES);
        const host = `${pick(this.HOSTS)}-${pick(this.SUFFIX)}`;
        const codename = `rogue-${this.formatSeed(seed)}`;
        const flag = `flag{rogue_${this.formatSeed(seed)}}`;
        const path = cls.tpl === 'cron_hijack' ? pick(this.CRON_SCRIPTS)
            : cls.tpl === 'path_hijack' ? pick(this.HELPERS)
                : pick(this.SUID_BINS);
        const sudoBin = pick(this.sudoBins());
        const hijackCmd = pick(this.HIJACK_CMDS);

        const tpl = window.BOXBUILDER.templates[cls.tpl];
        const part = tpl(path, flag, sudoBin, hijackCmd);

        // Two to four decoys, drawn without replacement so a seed can't
        // produce the same file twice.
        const pool = [...this.DECOYS];
        const decoyCount = 2 + Math.floor(rnd() * 3);
        for (let i = 0; i < decoyCount && pool.length; i++) {
            const d = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
            if (part.fs[d.path]) continue; // never overwrite the actual vector
            window.BOXBUILDER.placeFile(part.fs, d.path, {
                type: 'file', owner: 'root', mode: '644', content: d.content
            });
        }

        const box = {
            codename,
            title: { en: `Rogue · ${host}`, fr: `Rogue · ${host}`, es: `Rogue · ${host}` },
            brief: {
                en: `Unknown host, generated from seed ${this.formatSeed(seed)}. No briefing, no category, no hint about what is wrong with it. Enumerate it the way you would a real target.`,
                fr: `Hôte inconnu, généré depuis la graine ${this.formatSeed(seed)}. Pas de briefing, pas de catégorie, aucune indication sur ce qui cloche. Énumère-le comme une vraie cible.`,
                es: `Host desconocido, generado a partir de la semilla ${this.formatSeed(seed)}. Sin briefing, sin categoría, sin ninguna pista de qué falla. Enumera como lo harías con un objetivo real.`
            },
            user: 'player',
            host,
            cwd: '/home/player',
            // Deliberately generic: naming the vulnerability class in the
            // objectives would undo the entire point of the mode.
            objectives: {
                en: ['Enumerate the host', 'Identify the misconfiguration', 'Escalate to root'],
                fr: ['Énumérer la machine', 'Identifier la mauvaise configuration', 'Passer root'],
                es: ['Enumerar la máquina', 'Identificar la mala configuración', 'Escalar a root']
            },
            hints: { en: part.hints, fr: part.hints, es: part.hints },
            flag,
            fs: part.fs,
            wins: part.wins,
            debrief: { en: part.debrief, fr: part.debrief, es: part.debrief },
            rogue: { seed: this.formatSeed(seed), diff: cls.diff }
        };
        if (part.sudoers) box.sudoers = part.sudoers;
        if (part.harden) {
            box.harden = {
                type: part.harden.type,
                target: part.harden.target,
                obj: { en: part.harden.obj, fr: part.harden.obj, es: part.harden.obj },
                hint: { en: part.harden.hint, fr: part.harden.hint, es: part.harden.hint }
            };
        }
        return box;
    },

    // ── Session wiring ──────────────────────────────────────────────────
    // Generates, imports through the normal custom-box path, and hands back
    // the level index so the caller can drop the player straight into it.
    // A regenerated seed replaces its previous copy instead of stacking up.
    spawn(seedText) {
        const seed = seedText === undefined || seedText === '' || seedText === null
            ? this.randomSeed()
            : this.parseSeed(seedText);
        const box = this.build(seed);
        const existing = window.LEVELS.findIndex(l => l.codename === box.codename);
        if (existing >= 0) return { ok: true, index: existing, seed: this.formatSeed(seed), reused: true };
        const result = window.GAME_CUSTOM.import(JSON.stringify(box));
        if (!result.ok) return { ok: false, errors: result.errors, seed: this.formatSeed(seed) };
        const index = window.LEVELS.length - 1;
        // Rogue boxes carry their generated difficulty rather than 'CUSTOM',
        // so the time-attack budget and the hub tier label both make sense.
        if (window.MACHINE_META[index]) {
            window.MACHINE_META[index].cat = 'ROGUE';
            window.MACHINE_META[index].diff = 'ROGUE';
            window.MACHINE_META[index].tier = box.rogue.diff;
        }
        return { ok: true, index, seed: this.formatSeed(seed), reused: false };
    }
};
