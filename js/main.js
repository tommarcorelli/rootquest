// Per-machine metadata for the home hub (indexed like LEVELS)
window.MACHINE_META = [
    { cat: 'SUID',   diff: 'EASY' },
    { cat: 'CRON',   diff: 'EASY' },
    { cat: 'CAP',    diff: 'MEDIUM' },
    { cat: 'PATH',   diff: 'MEDIUM' },
    { cat: 'SUDO',   diff: 'HARD' },
    { cat: 'PASSWD', diff: 'EASY' },
    { cat: 'SUDO',   diff: 'EASY' },
    { cat: 'KERNEL', diff: 'MEDIUM' },
    { cat: 'CHAIN',  diff: 'HARD' },
    { cat: 'DOCKER', diff: 'HARD' },
    { cat: 'PRELOAD',  diff: 'MEDIUM' },
    { cat: 'WILDCARD', diff: 'HARD' },
    { cat: 'SSH',      diff: 'EASY' },
    { cat: 'SUDOERS',  diff: 'MEDIUM' },
    { cat: 'LD.PRELOAD', diff: 'HARD' },
    { cat: 'SUDO',     diff: 'EASY' },
    { cat: 'SUDO',     diff: 'EASY' },
    { cat: 'SUDO',     diff: 'MEDIUM' },
    { cat: 'SUDO',     diff: 'MEDIUM' },
    { cat: 'SUDO',     diff: 'HARD' },
    { cat: 'CAP',      diff: 'HARD' },
    { cat: 'LD.LIBPATH', diff: 'HARD' },
    { cat: 'NFS',      diff: 'HARD' },
    { cat: 'SUDO',     diff: 'EASY' },
    { cat: 'SUDO',     diff: 'MEDIUM' },
    { cat: 'EDITOR',   diff: 'MEDIUM' },
    { cat: 'CAP',      diff: 'HARD' },
    { cat: 'SUDO',     diff: 'HARD' },
    { cat: 'SUDO',     diff: 'EASY' },
    { cat: 'SUDO',     diff: 'MEDIUM' },
    { cat: 'SUDO',     diff: 'MEDIUM' },
    { cat: 'SUDO',     diff: 'MEDIUM' },
    { cat: 'SUDO',     diff: 'MEDIUM' },
    { cat: 'SUDO',     diff: 'EASY' },
    { cat: 'CRON',     diff: 'EASY' },
    { cat: 'SUDO',     diff: 'EASY' },
    { cat: 'SUDO',     diff: 'MEDIUM' },
    { cat: 'SUDO',     diff: 'EASY' }
];

// Difficulty tiers rendered on the hub, in order. CUSTOM only ever gets
// entries the player imports — buildHomeGrid skips a tier with none.
window.DIFF_TIERS = ['EASY', 'MEDIUM', 'HARD', 'CUSTOM'];

// Contextual cheatsheet: the commands worth trying on each machine category.
window.CHEATS_BY_CAT = {
    SUID:       ['find / -perm -4000 2>/dev/null', 'ls -la <bin>', 'strings <bin>'],
    CRON:       ['cat /etc/crontab', 'ls -la /opt', 'wait'],
    CAP:        ['getcap -r / 2>/dev/null'],
    PATH:       ['find / -perm -4000 2>/dev/null', 'strings <suid>', 'export PATH=/tmp:$PATH'],
    SUDO:       ['sudo -l'],
    PASSWD:     ['ls -la /etc/passwd', 'su <user>'],
    KERNEL:     ['uname -a', 'cat /etc/os-release', 'ls -la'],
    CHAIN:      ['cat /opt/app/config.php', 'su <user>', 'sudo -l'],
    DOCKER:     ['id', 'cat /etc/group', 'docker run -v /:/mnt ...'],
    PRELOAD:    ['sudo -l', 'gcc -shared -fPIC -o /tmp/x.so /tmp/x.c'],
    WILDCARD:   ['cat /etc/crontab', 'touch ./--checkpoint=1'],
    SSH:        ['ls -la /opt/backup', 'ssh -i <key> root@localhost'],
    SUDOERS:    ['ls -la /etc/sudoers.d', 'sudo -l'],
    'LD.PRELOAD': ['ls -la /etc/ld.so.preload', 'echo /tmp/x.so > /etc/ld.so.preload'],
    'LD.LIBPATH': ['sudo -l', 'cat /usr/local/bin/README.txt', 'gcc -shared -fPIC -nostartfiles -o /tmp/<lib> /tmp/<lib>.c'],
    NFS:        ['showmount -e', 'cat /etc/exports', 'mount -t nfs host:/export /mnt'],
    EDITOR:     ['sudo -l', 'chmod +x <script>', 'sudo EDITOR=<script> -e <file>']
};

// Achievements — checked against a small progress snapshot.
window.ACHIEVEMENTS = [
    { id: 'first_blood', icon: '🩸', name: { en: 'First Blood', fr: 'Premier sang', es: 'Primera sangre' }, desc: { en: 'Root your first machine', fr: 'Rooter ta première machine', es: 'Consigue root en tu primera máquina' }, check: s => s.owned >= 1 },
    { id: 'apprentice', icon: '🎓', name: { en: 'Apprentice', fr: 'Apprenti', es: 'Aprendiz' }, desc: { en: 'Own 5 machines', fr: 'Posséder 5 machines', es: 'Consigue 5 máquinas' }, check: s => s.owned >= 5 },
    { id: 'halfway', icon: '⚡', name: { en: 'Halfway There', fr: 'À mi-chemin', es: 'A mitad de camino' }, desc: { en: 'Own half the machines', fr: 'Posséder la moitié des machines', es: 'Consigue la mitad de las máquinas' }, check: s => s.owned >= Math.ceil(s.total / 2) },
    { id: 'root_wizard', icon: '👑', name: { en: 'Root Wizard', fr: 'Magicien du root', es: 'Mago del root' }, desc: { en: 'Own all machines', fr: 'Posséder toutes les machines', es: 'Consigue todas las máquinas' }, check: s => s.owned >= s.total },
    { id: 'defender', icon: '🛡️', name: { en: 'Defender', fr: 'Défenseur', es: 'Defensor' }, desc: { en: 'Harden a box (blue team)', fr: 'Durcir une box (blue team)', es: 'Endurece una box (blue team)' }, check: s => s.hardened >= 1 },
    { id: 'blue_legend', icon: '🔵', name: { en: 'Blue-Team Legend', fr: 'Légende blue team', es: 'Leyenda blue team' }, desc: { en: 'Harden every fixable box', fr: 'Durcir toutes les box corrigeables', es: 'Endurece todas las box corregibles' }, check: s => s.hardened >= s.hardenable },
    { id: 'ghost', icon: '👻', name: { en: 'Ghost', fr: 'Fantôme', es: 'Fantasma' }, desc: { en: 'Earn an S rank (no hints)', fr: 'Obtenir un rang S (sans indice)', es: 'Consigue un rango S (sin pistas)' }, check: s => s.sRank },
    { id: 'speedrunner', icon: '🏁', name: { en: 'Speedrunner', fr: 'Speedrunner', es: 'Speedrunner' }, desc: { en: 'Root a box in under 45s', fr: 'Rooter une box en moins de 45s', es: 'Consigue root en una box en menos de 45s' }, check: s => s.speed }
];

// Custom box import/export — validated JSON, no build step, no server.
// Levels are appended straight onto LEVELS/MACHINE_META so every existing
// consumer (hub grid, cheatsheet, mission panel, debrief) works unmodified.
window.GAME_CUSTOM = {
    STORE_KEY: 'rootquest_custom_levels',
    NEXT_ID_BASE: 9000,

    validate(obj) {
        const errors = [];
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { valid: false, errors: ['JSON must be an object'] };
        if (!obj.codename || typeof obj.codename !== 'string') errors.push('codename (string) is required');
        if (!obj.title || (typeof obj.title !== 'string' && !obj.title.en)) errors.push('title (string, or {en, fr}) is required');
        if (!obj.user || typeof obj.user !== 'string') errors.push('user (string) is required');
        if (!obj.host || typeof obj.host !== 'string') errors.push('host (string) is required');
        if (!obj.cwd || typeof obj.cwd !== 'string') errors.push('cwd (string) is required');
        if (!obj.fs || typeof obj.fs !== 'object' || !obj.fs['/'] || obj.fs['/'].type !== 'dir') errors.push('fs["/"] (root directory node) is required');
        if (!Array.isArray(obj.wins) || !obj.wins.length || !obj.wins.every(w => w && typeof w.type === 'string')) errors.push('wins: [{ type: "<string>" }, ...] is required');
        if (!obj.flag || typeof obj.flag !== 'string') errors.push('flag (string) is required');
        return { valid: errors.length === 0, errors };
    },

    // Accepts either a plain string or an {en, fr} object for any bilingual
    // field, and fills in the missing half so nothing downstream ever sees
    // an undefined translation.
    bi(v, fallback) {
        if (v && typeof v === 'object') {
            const en = v.en || v.fr || v.es || fallback;
            return { en, fr: v.fr || v.en || fallback, es: v.es || v.en || fallback };
        }
        const s = (v != null ? String(v) : fallback);
        return { en: s, fr: s, es: s };
    },

    // Same fallback contract as bi(), but for array-valued fields
    // (objectives/hints): a plain array applies to all three languages,
    // an { en, fr, es } object fills in missing translations from English.
    // Before this, a plain array silently normalized to [] in every
    // language — contradicting the README, which documents plain arrays
    // as accepted — so any custom box (including every box builder
    // template) authored with `"objectives": ["...", "..."]` lost its
    // objectives/hints entirely on import.
    biList(v, fallback) {
        if (Array.isArray(v)) return { en: v, fr: v, es: v };
        if (v && typeof v === 'object') {
            const en = v.en || v.fr || v.es || fallback;
            return { en, fr: v.fr || v.en || fallback, es: v.es || v.en || fallback };
        }
        return { en: fallback, fr: fallback, es: fallback };
    },

    normalize(obj, id) {
        return {
            id,
            codename: obj.codename,
            title: this.bi(obj.title, obj.codename),
            brief: this.bi(obj.brief, ''),
            user: obj.user,
            host: obj.host,
            cwd: obj.cwd,
            objectives: this.biList(obj.objectives, []),
            hints: this.biList(obj.hints, []),
            flag: obj.flag,
            fs: obj.fs,
            sudoers: obj.sudoers,
            env_keep: obj.env_keep,
            nfsExports: obj.nfsExports,
            vulnLib: obj.vulnLib,
            wins: obj.wins,
            debrief: obj.debrief,
            custom: true
        };
    },

    loadFromStorage() {
        let saved = [];
        try { saved = JSON.parse(localStorage.getItem(this.STORE_KEY) || '[]'); } catch { saved = []; }
        if (!Array.isArray(saved)) saved = [];
        for (const lvl of saved) {
            window.LEVELS.push(lvl);
            window.MACHINE_META.push({ cat: 'CUSTOM', diff: 'CUSTOM' });
        }
    },

    saveToStorage() {
        try {
            localStorage.setItem(this.STORE_KEY, JSON.stringify(window.LEVELS.filter(l => l.custom)));
        } catch { /* storage unavailable/full — import still works this session */ }
    },

    // Returns { ok: true, level } or { ok: false, errors }.
    import(jsonText) {
        let obj;
        try { obj = JSON.parse(jsonText); }
        catch (e) { return { ok: false, errors: ['Invalid JSON — ' + e.message] }; }
        const check = this.validate(obj);
        if (!check.valid) return { ok: false, errors: check.errors };
        const customCount = window.LEVELS.filter(l => l.custom).length;
        const lvl = this.normalize(obj, this.NEXT_ID_BASE + customCount);
        window.LEVELS.push(lvl);
        window.MACHINE_META.push({ cat: 'CUSTOM', diff: 'CUSTOM' });
        this.saveToStorage();
        return { ok: true, level: lvl };
    },

    // Re-serializes the authored shape of a level (drops the runtime `id`).
    exportJSON(idx) {
        const lvl = window.LEVELS[idx];
        if (!lvl) return null;
        const { id, custom, ...rest } = lvl;
        return JSON.stringify(rest, null, 2);
    },

    // ── Minimal base64 codec, hand-rolled on purpose ────────────────────────
    // No build step means no bundler-provided polyfills, and browser btoa()
    // only accepts Latin1 — so instead of fighting UTF-8/surrogate-pair edge
    // cases, we encodeURIComponent() first (guaranteed pure ASCII output),
    // then base64 that ASCII string ourselves. Portable across real browsers
    // and the Node vm sandbox the test harness runs in (no window.btoa there).
    _B64_ALPHABET: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    _toBase64(asciiStr) {
        const A = this._B64_ALPHABET;
        let out = '';
        for (let i = 0; i < asciiStr.length; i += 3) {
            const b0 = asciiStr.charCodeAt(i);
            const has1 = i + 1 < asciiStr.length;
            const has2 = i + 2 < asciiStr.length;
            const b1 = has1 ? asciiStr.charCodeAt(i + 1) : 0;
            const b2 = has2 ? asciiStr.charCodeAt(i + 2) : 0;
            out += A[b0 >> 2];
            out += A[((b0 & 3) << 4) | (b1 >> 4)];
            out += has1 ? A[((b1 & 15) << 2) | (b2 >> 6)] : '=';
            out += has2 ? A[b2 & 63] : '=';
        }
        return out;
    },
    _fromBase64(b64Str) {
        const A = this._B64_ALPHABET;
        const clean = String(b64Str || '').replace(/[^A-Za-z0-9+/]/g, '');
        let out = '';
        for (let i = 0; i < clean.length; i += 4) {
            const c0 = A.indexOf(clean[i]);
            const c1 = i + 1 < clean.length ? A.indexOf(clean[i + 1]) : -1;
            const c2 = i + 2 < clean.length ? A.indexOf(clean[i + 2]) : -1;
            const c3 = i + 3 < clean.length ? A.indexOf(clean[i + 3]) : -1;
            if (c0 < 0 || c1 < 0) break;
            out += String.fromCharCode((c0 << 2) | (c1 >> 4));
            if (c2 >= 0) out += String.fromCharCode(((c1 & 15) << 4) | (c2 >> 2));
            if (c3 >= 0) out += String.fromCharCode(((c2 & 3) << 6) | c3);
        }
        return out;
    },

    // Builds a self-contained shareable link: the box's authored JSON,
    // percent-encoded (→ pure ASCII, sidesteps UTF-8 base64 entirely) then
    // base64'd into the URL hash. Whoever opens the link gets it auto-imported.
    exportURL(idx) {
        const json = this.exportJSON(idx);
        if (!json) return null;
        const encoded = this._toBase64(encodeURIComponent(json));
        const base = (typeof location !== 'undefined' && location.href) ? location.href.split('#')[0] : '';
        return base + '#box=' + encoded;
    },

    // Reads a `#box=<encoded>` hash (with or without the leading '#') and
    // imports it like a pasted JSON box. Returns null if the hash has no
    // box payload at all (nothing to do — not an error).
    importFromHash(hash) {
        const m = /box=([^&]+)/.exec(hash || '');
        if (!m) return null;
        let json;
        try {
            json = decodeURIComponent(this._fromBase64(decodeURIComponent(m[1])));
        } catch (e) {
            return { ok: false, errors: ['Malformed share link'] };
        }
        return this.import(json);
    }
};

// Main game orchestration
window.GAME = {
    currentLevel: 0,   // index into LEVELS
    completed: [],     // level ids completed
    hardened: [],      // level ids also hardened (blue-team bonus)
    achievements: [],  // earned achievement ids
    flags: { sRank: false, speed: false }, // one-shot achievement triggers
    started: false,    // a machine has been entered at least once
    bestTimes: {},     // level id -> best clear time in seconds (speedrun records)
    ghosts: {},        // level id -> recorded command log ([{cmd, dt}]) of the run that set bestTimes[id]
    notifyDailyEnabled: false, // opt-in local reminder for the daily challenge
    lastDailyNotifiedKey: null, // date key (YYYY-M-D) of the last reminder shown, so it fires at most once/day

    STORAGE_KEY: 'rootquest_save_v1',

    level() { return LEVELS[this.currentLevel]; },

    // ── Persistence (progression + language) ────────────────────
    loadSave() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (Array.isArray(data.completed)) this.completed = data.completed;
            if (Array.isArray(data.hardened)) this.hardened = data.hardened;
            if (Array.isArray(data.achievements)) this.achievements = data.achievements;
            if (data.flags && typeof data.flags === 'object') this.flags = { sRank: !!data.flags.sRank, speed: !!data.flags.speed };
            if (data.bestTimes && typeof data.bestTimes === 'object') this.bestTimes = data.bestTimes;
            if (data.ghosts && typeof data.ghosts === 'object') this.ghosts = data.ghosts;
            if (Array.isArray(data.cmdHistory) && window.TERM) window.TERM.history = data.cmdHistory.slice(-300);
            if (data.lang === 'en' || data.lang === 'fr' || data.lang === 'es') window.currentLang = data.lang;
            if (typeof data.theme === 'string') window.currentTheme = data.theme;
            if (typeof data.notifyDailyEnabled === 'boolean') this.notifyDailyEnabled = data.notifyDailyEnabled;
            if (typeof data.lastDailyNotifiedKey === 'string') this.lastDailyNotifiedKey = data.lastDailyNotifiedKey;
        } catch (e) {
            // Corrupted or unavailable storage (private browsing, quota) — start fresh.
        }
    },

    saveProgress() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                completed: this.completed,
                hardened: this.hardened,
                achievements: this.achievements,
                flags: this.flags,
                bestTimes: this.bestTimes,
                ghosts: this.ghosts,
                cmdHistory: (window.TERM && window.TERM.history || []).slice(-300),
                lang: window.currentLang,
                theme: window.currentTheme || 'kali',
                notifyDailyEnabled: this.notifyDailyEnabled,
                lastDailyNotifiedKey: this.lastDailyNotifiedKey
            }));
        } catch (e) {
            // Storage unavailable — progress just won't persist across reloads.
        }
    },

    resetProgress() {
        if (!window.confirm(t('resetProgressConfirm'))) return;
        this.completed = [];
        this.hardened = [];
        this.achievements = [];
        this.flags = { sRank: false, speed: false };
        this.bestTimes = {};
        this.ghosts = {};
        this.saveProgress();
        this.buildHomeGrid();
        this.updateLevelsMap();
        this.updateProgress();
    },

    boot() {
        window.GAME_CUSTOM.loadFromStorage();
        this.importSharedBoxFromUrl();
        TERM.init();
        this.updateAchievements(false); // retroactively sync from saved progress
        this.buildLevelsMap();
        this.buildHomeGrid();
        this.wireUi();
        this.showHome();
        if (this._pendingShareToast) {
            this.simpleToast(this._pendingShareToast);
            this._pendingShareToast = null;
        }
    },

    // A shared link (#box=<encoded JSON>) auto-imports its box once, then the
    // hash is cleared so reloading/bookmarking the page doesn't re-import it
    // (or fight with saved custom boxes) on every visit.
    importSharedBoxFromUrl() {
        if (typeof location === 'undefined' || !location.hash) return;
        const result = window.GAME_CUSTOM.importFromHash(location.hash);
        if (!result) return; // no #box= payload — nothing to do
        if (typeof history !== 'undefined' && history.replaceState) {
            history.replaceState(null, '', location.pathname + location.search);
        }
        this._pendingShareToast = result.ok
            ? t('customShareImported')
            : t('customShareImportErr') + result.errors.join('; ');
    },

    loadLevel(idx) {
        this.currentLevel = idx;
        const lvl = LEVELS[idx];
        // Reset session
        SESSION.user = lvl.user;
        SESSION.host = lvl.host;
        SESSION.cwd = lvl.cwd;
        SESSION.prevCwd = null;
        SESSION.env = { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' };
        SESSION.isRoot = false;
        SESSION.hintIndex = 0;
        SESSION.pendingCron = false;
        SESSION.cronPayload = null;
        SESSION.cmdCount = 0;
        SESSION.cmdLog = [];
        SESSION.startTime = Date.now();
        SESSION.blueTeam = false;
        SESSION.sudoAuthed = false;
        SESSION.nfsMount = null;
        if (window.MENTOR) window.MENTOR.resetForLevel();
        document.body.classList.remove('is-root');

        // Load filesystem for level
        FS.load(lvl);

        // Reset terminal
        TERM.outputEl.innerHTML = '';
        TERM.typewriterGen = (TERM.typewriterGen || 0) + 1; // cancel any in-flight typewriter
        TERM.updatePrompt();

        // Render mission card + contextual cheatsheet
        this.renderMission();
        this.renderCheatsheet();

        // Welcome banner + level intro
        const welcome = t('welcome');
        const welcomeLines = welcome.map(line => ({
            text: line,
            cls: line.trim().startsWith('rootQuest') ? 'ok' : (line.includes('│') || line.includes('╭') || line.includes('╰') ? 'info' : '')
        }));
        TERM.printTypewriter(welcomeLines, { charDelay: 4, lineDelay: 20 });
        TERM.print([
            { text: `━━━ ${lvl.title[currentLang]} ━━━`, cls: 'flag' },
            { text: lvl.brief[currentLang], cls: 'dim' },
            { text: '', cls: '' }
        ]);
        TERM.scrollToBottom();

        this.updateLevelsMap();
        document.getElementById('levelNum').textContent = lvl.id;
        const totalEl = document.getElementById('levelTotal');
        if (totalEl) totalEl.textContent = LEVELS.length;
        document.getElementById('termTitle').textContent = `${lvl.user}@${lvl.host}: ~`;
        document.getElementById('missionStatus').textContent = t('statusActive');
        this.updateProgress();
    },

    // ── Home / machine-select hub ───────────────────────────────
    buildHomeGrid() {
        const grid = document.getElementById('homeGrid');
        if (!grid) return;
        grid.innerHTML = '';
        // Group machines by difficulty tier so the hub scales as boxes are added.
        for (const tier of (window.DIFF_TIERS || ['EASY', 'MEDIUM', 'HARD'])) {
            const idxs = [];
            for (let i = 0; i < LEVELS.length; i++) {
                if ((MACHINE_META[i]?.diff || '') === tier) idxs.push(i);
            }
            if (!idxs.length) continue;
            const owned = idxs.filter(i => this.completed.includes(LEVELS[i].id)).length;
            const label = document.createElement('div');
            label.className = 'home-tier-label tier-' + tier.toLowerCase();
            label.innerHTML =
                `<span class="tier-name">${t('tier' + tier[0] + tier.slice(1).toLowerCase())}</span>` +
                `<span class="tier-count">${owned}/${idxs.length}</span>`;
            grid.appendChild(label);
            for (const i of idxs) grid.appendChild(this.buildMachineCard(i));
        }
        this.updateHomeProgress();
        this.renderOperatorStatus();
        this.renderAchievements();
        this.renderDailyChallenge();
        this.renderHallOfFame();
        this.renderNotifyButton();
    },

    // Syncs the 🔔 button's label/state with the actual opt-in flag AND the
    // real browser permission — the two can disagree (e.g. the player
    // enabled it, then later blocked notifications in browser settings), and
    // the button should reflect reality rather than just the stored flag.
    renderNotifyButton() {
        const btn = document.getElementById('notifyToggleBtn');
        if (!btn) return;
        const supported = typeof Notification !== 'undefined';
        if (!supported) { btn.hidden = true; return; }
        btn.hidden = false;
        if (Notification.permission === 'denied') {
            btn.querySelector('span').textContent = t('notifyDenied');
            btn.setAttribute('aria-pressed', 'false');
            btn.disabled = true;
            return;
        }
        btn.disabled = false;
        const on = this.notifyDailyEnabled && Notification.permission === 'granted';
        btn.querySelector('span').textContent = t(on ? 'notifyToggleOn' : 'notifyToggleOff');
        btn.setAttribute('aria-pressed', String(on));
    },

    // Local "Hall of Fame": every owned machine with a recorded speedrun
    // time, ranked fastest-first. Pure read of already-persisted state
    // (this.bestTimes / this.completed) — no new tracking needed, no
    // server, nothing shared between browsers.
    renderHallOfFame() {
        const panel = document.getElementById('halloffamePanel');
        if (!panel) return;
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const entries = Object.keys(this.bestTimes || {})
            .map(id => ({ id: Number(id), sec: this.bestTimes[id] }))
            .filter(e => this.completed.includes(e.id) && LEVELS.some(l => l.id === e.id))
            .sort((a, b) => a.sec - b.sec);
        if (!entries.length) {
            panel.innerHTML = `<p class="halloffame-empty">${esc(t('halloffameEmpty'))}</p>`;
            return;
        }
        const medal = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
        panel.innerHTML = '<ol class="halloffame-list">' + entries.map((e, i) => {
            const lvl = LEVELS.find(l => l.id === e.id);
            const title = (lvl.title[currentLang] || lvl.title.en).split('·').pop().trim();
            const hasGhost = Array.isArray(this.ghosts && this.ghosts[e.id]) && this.ghosts[e.id].length > 0;
            const ghostBtn = hasGhost
                ? `<button class="hof-ghost-btn" type="button" data-ghost-id="${e.id}" title="${esc(t('ghostReplayBtn'))}" aria-label="${esc(t('ghostReplayBtn'))}">👻</button>`
                : '';
            return `<li><span class="hof-medal">${medal(i)}</span>` +
                `<span class="hof-name">${esc(title)}</span>` +
                `<span class="hof-time">${this.formatTime(e.sec)}</span>${ghostBtn}</li>`;
        }).join('') + '</ol>';
    },

    // Replays a stored ghost log (the command sequence from the run that set
    // a level's best time) sequentially in the real terminal — not a visual
    // overlay, a genuine playback: the level reloads fresh and the recorded
    // commands run themselves, at compressed timing, exactly as the player
    // typed them. Any keypress interrupts and hands control back.
    playGhost(id) {
        const log = this.ghosts && this.ghosts[id];
        if (!log || !log.length) return;
        const idx = LEVELS.findIndex(l => l.id === id);
        if (idx < 0) return;
        this.selectMachine(idx);

        SESSION.ghostReplaying = true;
        if (TERM.inputEl) TERM.inputEl.disabled = true;
        TERM.print([{ text: '', cls: '' }, { text: '👻 ' + t('ghostReplayStart'), cls: 'ghost' }]);
        TERM.scrollToBottom();

        const steps = window.GHOST.compressGaps(log, 1200);
        const timers = [];
        const finish = (interrupted) => {
            if (!SESSION.ghostReplaying) return; // already finished — avoid a double message
            timers.forEach(clearTimeout);
            SESSION.ghostReplaying = false;
            if (TERM.inputEl) { TERM.inputEl.disabled = false; TERM.inputEl.focus(); }
            TERM.print([{ text: '👻 ' + t(interrupted ? 'ghostReplayInterrupted' : 'ghostReplayDone'), cls: 'ghost' }]);
            TERM.scrollToBottom();
            document.removeEventListener('keydown', onInterrupt, true);
        };
        const onInterrupt = () => finish(true);
        document.addEventListener('keydown', onInterrupt, true);
        steps.forEach((step, i) => {
            timers.push(setTimeout(() => {
                if (!SESSION.ghostReplaying) return;
                TERM.submit(step.cmd);
                if (i === steps.length - 1) finish(false);
            }, step.dt));
        });
    },

    // Shared date key (local time) used both to pick today's challenge and
    // to track whether today's reminder has already fired.
    todayKey() {
        const d = new Date();
        return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    },

    dailySeed() {
        const key = this.todayKey();
        let h = 0;
        for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
        return h;
    },

    builtInIndexes() {
        const idxs = [];
        for (let i = 0; i < LEVELS.length; i++) if (!LEVELS[i].custom) idxs.push(i);
        return idxs;
    },

    dailyChallengeIndex() {
        const pool = this.builtInIndexes();
        return pool.length ? pool[this.dailySeed() % pool.length] : 0;
    },

    // Pure decision — no DOM/Notification API calls in here, so it's testable
    // headlessly: true only if the player opted in, the browser has actually
    // granted permission, today's reminder hasn't fired yet, and today's pick
    // isn't already owned.
    shouldNotifyDaily() {
        if (!this.notifyDailyEnabled) return false;
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
        if (this.lastDailyNotifiedKey === this.todayKey()) return false;
        const lvl = LEVELS[this.dailyChallengeIndex()];
        if (!lvl || this.completed.includes(lvl.id)) return false;
        return true;
    },

    // Only the side-effecting half: fire the actual Notification and record
    // that today's reminder has been shown. Foreground-only — this is a
    // plain Notification, not a Push subscription, so it can only fire while
    // this tab has loaded; there is no background delivery without a push
    // server, which this static, serverless game doesn't have.
    fireDailyNotificationIfDue() {
        if (!this.shouldNotifyDaily()) return false;
        const lvl = LEVELS[this.dailyChallengeIndex()];
        const title = lvl.title[window.currentLang] || lvl.title.en;
        const vuln = (title.split('·')[1] || title).trim();
        try {
            new Notification('rootQuest', { body: `${t('dailyNotifyBody')} ${lvl.codename.toUpperCase()} — ${vuln}`, icon: './assets/icons/icon-192.png' });
        } catch (e) { /* some browsers require a service-worker-registered notification; best-effort only */ }
        this.lastDailyNotifiedKey = this.todayKey();
        this.saveProgress();
        return true;
    },

    renderDailyChallenge() {
        const nameEl = document.getElementById('dailyName');
        if (!nameEl) return;
        const idx = this.dailyChallengeIndex();
        const lvl = LEVELS[idx];
        const vuln = (lvl.title[currentLang].split('·')[1] || lvl.title[currentLang]).trim();
        nameEl.textContent = `${lvl.codename.toUpperCase()} — ${vuln}`;
    },

    playDailyChallenge() {
        this.selectMachine(this.dailyChallengeIndex());
    },

    // Random pick, weighted toward machines not yet owned so it stays useful
    // once most of the lab is done; falls back to any built-in box.
    surpriseMe() {
        const pool = this.builtInIndexes();
        if (!pool.length) return;
        const notDone = pool.filter(i => !this.completed.includes(LEVELS[i].id));
        const from = notDone.length ? notDone : pool;
        this.selectMachine(from[Math.floor(Math.random() * from.length)]);
    },

    buildMachineCard(i) {
        const lvl = LEVELS[i];
        const meta = MACHINE_META[i] || { cat: '???', diff: '' };
        const owned = this.completed.includes(lvl.id);
        const vuln = (lvl.title[currentLang].split('·')[1] || lvl.title[currentLang]).trim();

        const card = document.createElement('div');
        card.className = 'machine-card hud' + (owned ? ' is-owned' : '');
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `${lvl.codename} — ${vuln}`);
        card.setAttribute('data-idx', i);
        card.setAttribute('data-testid', `machine-card-${lvl.id}`);
        const best = this.bestTimes[lvl.id];
        card.innerHTML =
            '<div class="mc-top">' +
                `<span class="mc-id">${lvl.codename.toUpperCase()}</span>` +
                `<span class="mc-cat">${meta.cat}</span>` +
            '</div>' +
            `<div class="mc-name">${vuln}</div>` +
            `<div class="mc-brief">${lvl.brief[currentLang]}</div>` +
            '<div class="mc-foot">' +
                `<span class="mc-status">${owned ? '◆ ' + t('homeCardOwned') : '◇ ' + t('homeCardReady')}${this.hardened.includes(lvl.id) ? ' 🛡' : ''}${owned && best !== undefined ? ` ⏱ ${this.formatTime(best)}` : ''}</span>` +
                `<span class="mc-diff">${meta.diff}</span>` +
                `<span class="mc-enter">${t('homeEnter')} →</span>` +
            '</div>';
        card.addEventListener('click', () => this.selectMachine(i));
        card.addEventListener('keydown', (e) => {
            if (e.target !== card) return; // don't fire on the nested export button
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.selectMachine(i); }
        });
        const exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.className = 'mc-export';
        exportBtn.title = t('customExportTitle');
        exportBtn.setAttribute('aria-label', t('customExportTitle'));
        exportBtn.setAttribute('data-testid', `machine-card-export-${lvl.id}`);
        exportBtn.textContent = '{ }';
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.exportLevelJSON(i);
        });
        card.appendChild(exportBtn);
        if (lvl.custom) {
            const shareBtn = document.createElement('button');
            shareBtn.type = 'button';
            shareBtn.className = 'mc-export mc-share';
            shareBtn.title = t('customShareTitle');
            shareBtn.setAttribute('aria-label', t('customShareTitle'));
            shareBtn.setAttribute('data-testid', `machine-card-share-${lvl.id}`);
            shareBtn.textContent = '🔗';
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.shareLevelURL(i);
            });
            card.appendChild(shareBtn);
        }
        return card;
    },

    updateHomeProgress() {
        const el = document.getElementById('homeProgressText');
        if (el) el.textContent = `${this.completed.length} / ${LEVELS.length}`;
    },

    selectMachine(idx) {
        this.started = true;
        this.loadLevel(idx);
        this.hideHome();
        if (TERM.inputEl) TERM.inputEl.focus();
    },

    startBreach() {
        // Jump to the first machine not yet owned, else the first one.
        let idx = LEVELS.findIndex(l => !this.completed.includes(l.id));
        if (idx < 0) idx = 0;
        this.selectMachine(idx);
    },

    showHome() {
        this.buildHomeGrid();
        document.getElementById('winModal').style.display = 'none';
        document.getElementById('finalModal').style.display = 'none';
        const home = document.getElementById('homeScreen');
        if (home) home.classList.remove('home--hidden');
    },

    hideHome() {
        const home = document.getElementById('homeScreen');
        if (home) home.classList.add('home--hidden');
    },

    returnToMenu() {
        this.showHome();
    },

    renderMission() {
        const lvl = this.level();
        document.getElementById('missionTitle').textContent = lvl.title[currentLang];
        document.getElementById('missionBrief').textContent = lvl.brief[currentLang];
        const list = document.getElementById('objectivesList');
        list.innerHTML = '';
        for (const obj of lvl.objectives[currentLang]) {
            const li = document.createElement('li');
            li.textContent = obj;
            list.appendChild(li);
        }
        document.getElementById('targetInfo').textContent = `${lvl.user}@${lvl.host}`;
        this.renderWalkthrough();
    },

    // "Explanation mode" panel: a fully worked, annotated solution for the
    // current box, from window.WALKTHROUGHS. Purely informational — never
    // touches SESSION, scoring, or the hint counter. Hidden unless toggled
    // on via the 🎓 topbar button.
    renderWalkthrough() {
        const panel = document.getElementById('walkthroughPanel');
        const list = document.getElementById('walkthroughList');
        if (!panel || !list) return;
        const on = window.WALKMODE && window.WALKMODE.enabled;
        panel.style.display = on ? '' : 'none';
        if (!on) return;
        const lvl = this.level();
        const steps = (window.WALKTHROUGHS && window.WALKTHROUGHS[lvl.id]) || null;
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (!steps || !steps.length) {
            list.innerHTML = `<li class="walkthrough-empty">${esc(t('explainEmpty'))}</li>`;
            return;
        }
        list.innerHTML = steps.map((s, i) =>
            `<li><div class="walkthrough-step">${esc(t('explainStep'))} ${i + 1}</div>` +
            `<code>${esc(s.cmd)}</code>` +
            `<p>${esc(s.explain[currentLang] || s.explain.en)}</p></li>`
        ).join('');
    },

    // Sidebar cheatsheet, tailored to the current machine's category. Click a
    // command to drop it into the prompt.
    renderCheatsheet() {
        const ul = document.getElementById('cheatList');
        if (!ul) return;
        const meta = MACHINE_META[this.currentLevel] || {};
        const specific = (window.CHEATS_BY_CAT && window.CHEATS_BY_CAT[meta.cat]) || [];
        const cmds = [...specific, 'id', 'help', 'hint'];
        const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        ul.innerHTML = cmds.map(c => `<li><code tabindex="0" role="button">${esc(c)}</code></li>`).join('');
        ul.querySelectorAll('code').forEach(el => {
            el.title = t('cheatInsert');
            el.addEventListener('click', () => this.useCheat(el.textContent, el));
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.useCheat(el.textContent, el); }
            });
        });
    },

    useCheat(cmd, el) {
        if (TERM.inputEl) { TERM.inputEl.value = cmd; TERM.inputEl.focus(); }
        try { if (navigator.clipboard) navigator.clipboard.writeText(cmd); } catch (e) { /* ignore */ }
        if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 450); }
    },

    // Hub "operator profile": overall progress + a callsign rank.
    renderOperatorStatus() {
        const el = document.getElementById('operatorStatus');
        if (!el) return;
        const total = LEVELS.length;
        const owned = this.completed.length;
        const hardened = this.hardened.length;
        const pct = total ? Math.round((owned / total) * 100) : 0;
        const rank = this.operatorRank(pct, owned, hardened, total, LEVELS.filter(l => l.harden).length);
        el.innerHTML =
            `<div class="op-head"><span class="op-label">${t('opRank')}</span><span class="op-rank">${rank}</span></div>` +
            `<div class="op-bar"><span style="width:${pct}%"></span></div>` +
            `<div class="op-metrics">` +
                `<span><strong>${owned}</strong>/${total} ${t('opOwned')}</span>` +
                `<span><strong>${hardened}</strong> ${t('opHardened')} 🛡</span>` +
                `<span><strong>${pct}%</strong> ${t('opComplete')}</span>` +
            `</div>`;
    },

    operatorRank(pct, owned, hardened, total, hardenable) {
        if (owned === total && hardened >= (hardenable || 6)) return 'BLUE-TEAM LEGEND';
        if (pct >= 100) return 'ROOT WIZARD';
        if (pct >= 75) return 'ROOT HUNTER';
        if (pct >= 50) return 'OPERATOR';
        if (pct >= 25) return 'INITIATE';
        if (owned > 0) return 'SCRIPT KIDDIE';
        return 'RECRUIT';
    },

    buildLevelsMap() {
        const map = document.getElementById('levelsMap');
        map.innerHTML = '';
        for (let i = 0; i < LEVELS.length; i++) {
            const node = document.createElement('div');
            node.className = 'level-node';
            node.textContent = LEVELS[i].id;
            node.setAttribute('data-testid', `level-node-${LEVELS[i].id}`);
            node.setAttribute('role', 'button');
            node.setAttribute('tabindex', '0');
            node.setAttribute('aria-label', `${LEVELS[i].codename}`);
            const activate = () => {
                if (this.completed.includes(LEVELS[i].id) || i === this.currentLevel) {
                    this.loadLevel(i);
                }
            };
            node.addEventListener('click', activate);
            node.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
            });
            map.appendChild(node);
        }
    },

    updateLevelsMap() {
        const nodes = document.querySelectorAll('.level-node');
        nodes.forEach((n, i) => {
            n.classList.remove('active', 'done');
            if (this.completed.includes(LEVELS[i].id)) n.classList.add('done');
            if (i === this.currentLevel) n.classList.add('active');
        });
    },

    updateProgress() {
        const pct = (this.completed.length / LEVELS.length) * 100;
        document.getElementById('progressFill').style.width = pct + '%';
    },

    giveHint() {
        const lvl = this.level();
        const hints = lvl.hints[currentLang];
        if (SESSION.hintIndex >= hints.length) return [{ text: t('noMoreHints'), cls: 'dim' }];
        const h = hints[SESSION.hintIndex];
        SESSION.hintIndex++;
        return [
            { text: `[${t('hintUsed')} ${SESSION.hintIndex}/${hints.length}]`, cls: 'warn' },
            { text: '  ' + h, cls: 'info' },
            { text: '', cls: '' }
        ];
    },

    win() {
        const lvl = this.level();
        if (!this.completed.includes(lvl.id)) this.completed.push(lvl.id);
        this.saveProgress();
        this.updateLevelsMap();
        this.updateProgress();
        document.getElementById('missionStatus').textContent = t('statusDone');

        if (this.currentLevel >= LEVELS.length - 1) {
            // All done
            this.updateAchievements(true);
            document.getElementById('finalModal').style.display = 'flex';
            return;
        }
        document.getElementById('winFlag').textContent = lvl.flag;
        this.renderDebrief(lvl);
        this.renderKillChain(lvl);
        this.renderStats();
        this.updateAchievements(true);
        const btBtn = document.getElementById('blueTeamBtn');
        if (btBtn) btBtn.style.display = (lvl.harden && !this.hardened.includes(lvl.id)) ? '' : 'none';
        document.getElementById('winModal').style.display = 'flex';
    },

    // Blue-team phase: drop back into the terminal (still root) to harden the box.
    startBlueTeam() {
        const lvl = this.level();
        if (!lvl.harden) return;
        document.getElementById('winModal').style.display = 'none';
        SESSION.blueTeam = true;
        const h = lvl.harden;
        TERM.print([
            { text: '', cls: '' },
            { text: '━━━ ' + t('blueTeamTag') + ' ━━━', cls: 'info' },
            { text: t('blueTeamIntro'), cls: 'dim' },
            { text: '» ' + h.obj[currentLang], cls: 'warn' },
            { text: '  ' + t('blueTeamHintLabel') + ': ' + h.hint[currentLang], cls: 'dim' },
            { text: '', cls: '' }
        ]);
        TERM.scrollToBottom();
        if (TERM.inputEl) TERM.inputEl.focus();
    },

    markHardened(level) {
        if (!this.hardened.includes(level.id)) this.hardened.push(level.id);
        this.saveProgress();
    },

    // Victory scorecard: time, hints, commands, score + rank.
    renderStats() {
        const el = document.getElementById('winStats');
        if (!el) return;
        const sec = SESSION.startTime ? Math.max(0, Math.round((Date.now() - SESSION.startTime) / 1000)) : 0;
        const mm = String(Math.floor(sec / 60)).padStart(2, '0');
        const ss = String(sec % 60).padStart(2, '0');
        const hints = SESSION.hintIndex || 0;
        const totalHints = (this.level().hints[currentLang] || []).length;
        const cmds = SESSION.cmdCount || 0;
        const score = Math.max(50, 1000 - hints * 200 - Math.floor(sec / 10) * 5 - cmds * 3);
        const rank = hints === 0 ? 'S' : hints === 1 ? 'A' : hints === 2 ? 'B' : 'C';
        const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
        set('statTime', `${mm}:${ss}`);
        set('statHints', `${hints}/${totalHints}`);
        set('statCmds', cmds);
        set('statScore', score);
        const rankEl = document.getElementById('statRank');
        if (rankEl) { rankEl.textContent = rank; rankEl.className = 'stat-rank rank-' + rank; }
        if (rank === 'S') this.flags.sRank = true;
        if (sec > 0 && sec < 45) this.flags.speed = true;

        // Speedrun record for this box — kept across resets of a single level
        // (retrying doesn't erase a personal best, only beating it updates it).
        const lvlId = this.level().id;
        const prevBest = this.bestTimes[lvlId];
        let isNewBest = false;
        if (sec > 0 && (prevBest === undefined || sec < prevBest)) {
            this.bestTimes[lvlId] = sec;
            isNewBest = true;
            // The ghost is tied to the run that earned this record — captured
            // here, at the exact moment it becomes the new best, not before.
            if (Array.isArray(SESSION.cmdLog) && SESSION.cmdLog.length) {
                this.ghosts[lvlId] = SESSION.cmdLog.slice(0, 200); // defensive cap
            }
        }
        const bestEl = document.getElementById('statBest');
        if (bestEl) {
            const best = this.bestTimes[lvlId];
            bestEl.textContent = best !== undefined ? this.formatTime(best) + (isNewBest ? ` ${t('newBest')}` : '') : '—';
        }
        this.saveProgress();
    },

    formatTime(sec) {
        const mm = String(Math.floor(sec / 60)).padStart(2, '0');
        const ss = String(sec % 60).padStart(2, '0');
        return `${mm}:${ss}`;
    },

    // Gathers the data for the "proof of root" card straight from the
    // already-rendered scorecard (renderStats runs right before the win
    // modal opens) plus the operator profile — no extra state to track.
    async openProofModal() {
        const lvl = this.level();
        const get = (id) => { const n = document.getElementById(id); return n ? n.textContent : ''; };
        const total = LEVELS.length;
        const owned = this.completed.length;
        const hardened = this.hardened.length;
        const pct = total ? Math.round((owned / total) * 100) : 0;
        const opRank = this.operatorRank(pct, owned, hardened, total, LEVELS.filter(l => l.harden).length);
        const rankText = get('statRank') || 'C';
        const data = {
            codename: lvl.codename.toUpperCase(),
            title: (lvl.title[currentLang].split('·')[1] || lvl.title[currentLang]).trim(),
            rank: rankText,
            time: get('statTime') || '00:00',
            best: (get('statBest') || '').replace(/★.*/, '').trim(),
            hints: get('statHints') || '0/3',
            cmds: get('statCmds') || '0',
            score: get('statScore') || '0',
            hardened,
            opRank,
            owned,
            total,
            lang: currentLang,
            date: new Date().toISOString().slice(0, 10)
        };
        const canvas = document.getElementById('proofCanvas');
        const modal = document.getElementById('proofModal');
        if (!canvas || !modal || !window.PROOF) return;
        modal.style.display = 'flex';
        await window.PROOF.render(canvas, data);
    },

    // ── Achievements ────────────────────────────────────────────
    achState() {
        return { owned: this.completed.length, hardened: this.hardened.length, total: LEVELS.length, hardenable: LEVELS.filter(l => l.harden).length, sRank: !!this.flags.sRank, speed: !!this.flags.speed };
    },
    isThemeUnlocked(name) {
        const req = window.UNLOCKABLE_THEMES && window.UNLOCKABLE_THEMES[name];
        return !req || this.achievements.includes(req);
    },
    updateAchievements(toast) {
        const s = this.achState();
        const earned = ACHIEVEMENTS.filter(a => a.check(s)).map(a => a.id);
        const fresh = earned.filter(id => !this.achievements.includes(id));
        if (fresh.length) {
            this.achievements = earned;
            this.saveProgress();
            if (toast) fresh.forEach(id => this.achievementToast(ACHIEVEMENTS.find(a => a.id === id)));
            if (window.refreshThemeOptions) window.refreshThemeOptions();
        }
        return earned;
    },
    renderAchievements() {
        const el = document.getElementById('achievements');
        if (!el) return;
        const earned = new Set(this.achievements);
        const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        el.innerHTML =
            `<div class="ach-title">${t('achTitle')} <span class="ach-count">${earned.size}/${ACHIEVEMENTS.length}</span></div>` +
            '<div class="ach-row">' + ACHIEVEMENTS.map(a => {
                const got = earned.has(a.id);
                return `<div class="ach ${got ? 'is-earned' : 'is-locked'}" title="${esc(a.name[currentLang])} — ${esc(a.desc[currentLang])}">` +
                    `<span class="ach-icon">${got ? a.icon : '🔒'}</span>` +
                    `<span class="ach-name">${esc(a.name[currentLang])}</span></div>`;
            }).join('') + '</div>';
    },
    achievementToast(a) {
        if (!a) return;
        const div = document.createElement('div');
        div.className = 'ach-toast';
        div.innerHTML = `<span class="ach-toast-icon">${a.icon}</span><span class="ach-toast-txt"><strong>${t('achUnlocked')}</strong><br>${a.name[currentLang]}</span>`;
        document.body.appendChild(div);
        if (window.SFX) window.SFX.win();
        requestAnimationFrame(() => div.classList.add('show'));
        setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 400); }, 2800);
    },

    // Plain transient message — same visual language as achievementToast,
    // no icon/sound, used for import/export feedback.
    simpleToast(msg) {
        const div = document.createElement('div');
        div.className = 'ach-toast ach-toast-plain';
        div.innerHTML = `<span class="ach-toast-txt">${msg}</span>`;
        document.body.appendChild(div);
        requestAnimationFrame(() => div.classList.add('show'));
        setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 400); }, 2400);
    },

    // Copies a box's authored JSON to the clipboard (card's "{ }" button).
    exportLevelJSON(idx) {
        const json = window.GAME_CUSTOM.exportJSON(idx);
        if (!json) return;
        const done = () => this.simpleToast(t('customExportOk'));
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(json).then(done, done);
        } else {
            done();
        }
    },

    // Copies a self-contained share link for a custom box (card's "🔗" button).
    shareLevelURL(idx) {
        const url = window.GAME_CUSTOM.exportURL(idx);
        if (!url) return;
        const done = () => this.simpleToast(t('customShareOk'));
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done, done);
        } else {
            done();
        }
    },

    // Validates + imports the textarea's JSON as a new playable box.
    importCustomLevel(jsonText) {
        const result = window.GAME_CUSTOM.import(jsonText);
        const msgEl = document.getElementById('customJsonMsg');
        if (!result.ok) {
            if (msgEl) { msgEl.textContent = t('customImportErr') + result.errors.join('; '); msgEl.className = 'custom-json-msg is-err'; }
            return;
        }
        if (msgEl) { msgEl.textContent = t('customImportOk'); msgEl.className = 'custom-json-msg is-ok'; }
        this.buildHomeGrid();
    },

    renderDebrief(lvl) {
        const debrief = lvl.debrief && (lvl.debrief[currentLang] || lvl.debrief.en);
        const el = document.getElementById('winDebrief');
        if (!debrief || !el) {
            if (el) el.style.display = 'none';
            return;
        }
        el.style.display = '';
        document.getElementById('debriefVuln').textContent = debrief.vuln;
        document.getElementById('debriefWhy').textContent = debrief.why;
        document.getElementById('debriefFix').textContent = debrief.fix;
        const link = document.getElementById('debriefLink');
        if (debrief.link) {
            link.href = debrief.link;
            link.style.display = '';
        } else {
            link.style.display = 'none';
        }
    },

    // Kill chain: a compact visual replay of the box's solution, bucketed
    // into Recon / Setup / Exploit purely by step position (first/middle/
    // last third of the authored walkthrough) — no per-box authoring needed,
    // works for all 33 built-in boxes since every one already has a
    // WALKTHROUGHS entry (enforced by the harness's coverage test). Custom
    // boxes without a walkthrough simply hide the panel.
    renderKillChain(lvl) {
        const panel = document.getElementById('killchainPanel');
        const flow = document.getElementById('killchainFlow');
        if (!panel || !flow) return;
        const steps = (window.WALKTHROUGHS && window.WALKTHROUGHS[lvl.id]) || [];
        if (!steps.length) { panel.style.display = 'none'; return; }
        panel.style.display = '';

        const n = steps.length;
        const stageOf = (i) => i < Math.ceil(n / 3) ? 0 : (i < Math.ceil(2 * n / 3) ? 1 : 2);
        const buckets = [[], [], []];
        steps.forEach((s, i) => buckets[stageOf(i)].push(s));
        const stageKeys = ['killchainRecon', 'killchainSetup', 'killchainExploit'];
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const nodes = [];
        buckets.forEach((bucket, i) => {
            if (!bucket.length) return;
            nodes.push(
                `<div class="killchain-node stage-${i}">` +
                `<div class="killchain-label">${esc(t(stageKeys[i]))}</div>` +
                bucket.map(s => `<code>${esc(s.cmd)}</code>`).join('') +
                `</div>`
            );
        });
        nodes.push(
            `<div class="killchain-node stage-root">` +
            `<div class="killchain-label">👑 ${esc(t('killchainRoot'))}</div>` +
            `<code>${esc(lvl.flag || '')}</code>` +
            `</div>`
        );
        flow.innerHTML = nodes.join('<div class="killchain-arrow">→</div>');
    },

    nextLevel() {
        if (this.currentLevel < LEVELS.length - 1) {
            document.getElementById('winModal').style.display = 'none';
            this.loadLevel(this.currentLevel + 1);
            return [];
        }
        return [{ text: 'No more levels.', cls: 'dim' }];
    },

    reset() {
        this.loadLevel(this.currentLevel);
    },

    wireUi() {
        document.getElementById('hintBtn').addEventListener('click', () => {
            TERM.print(this.giveHint());
            TERM.scrollToBottom();
            TERM.inputEl.focus();
        });
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('nextLevelBtn').addEventListener('click', () => {
            document.getElementById('winModal').style.display = 'none';
            this.nextLevel();
        });
        document.getElementById('replayBtn').addEventListener('click', () => {
            document.getElementById('winModal').style.display = 'none';
            this.reset();
        });
        const blueTeamBtn = document.getElementById('blueTeamBtn');
        if (blueTeamBtn) blueTeamBtn.addEventListener('click', () => this.startBlueTeam());
        document.getElementById('restartAllBtn').addEventListener('click', () => {
            document.getElementById('finalModal').style.display = 'none';
            this.completed = [];
            this.saveProgress();
            this.loadLevel(0);
        });

        const resetProgressBtn = document.getElementById('resetProgressBtn');
        if (resetProgressBtn) resetProgressBtn.addEventListener('click', () => this.resetProgress());

        // Home hub wiring
        document.getElementById('menuBtn').addEventListener('click', () => this.returnToMenu());
        document.getElementById('homeStartBtn').addEventListener('click', () => this.startBreach());
        document.getElementById('winMenuBtn').addEventListener('click', () => this.returnToMenu());
        document.getElementById('finalMenuBtn').addEventListener('click', () => this.returnToMenu());

        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => window.setLanguage(btn.getAttribute('data-lang')));
        });

        document.querySelectorAll('.theme-select').forEach(sel => {
            sel.addEventListener('change', () => window.setTheme(sel.value));
        });

        document.querySelectorAll('.sound-btn').forEach(b => {
            b.addEventListener('click', () => window.SFX && window.SFX.toggle());
        });

        document.querySelectorAll('.explain-btn').forEach(b => {
            b.addEventListener('click', () => {
                if (window.WALKMODE) window.WALKMODE.toggle();
                if (window.GAME && window.GAME.level) window.GAME.renderWalkthrough();
            });
        });

        document.querySelectorAll('.mentor-btn').forEach(b => {
            b.addEventListener('click', () => { if (window.MENTORMODE) window.MENTORMODE.toggle(); });
        });

        const proofBtn = document.getElementById('proofBtn');
        if (proofBtn) proofBtn.addEventListener('click', () => this.openProofModal());
        const proofCloseBtn = document.getElementById('proofCloseBtn');
        if (proofCloseBtn) proofCloseBtn.addEventListener('click', () => {
            document.getElementById('proofModal').style.display = 'none';
        });
        const proofDownloadBtn = document.getElementById('proofDownloadBtn');
        if (proofDownloadBtn) proofDownloadBtn.addEventListener('click', () => {
            const canvas = document.getElementById('proofCanvas');
            const lvl = this.level();
            if (canvas && window.PROOF) window.PROOF.download(canvas, `rootquest-${lvl.codename}-proof.png`);
        });

        const customToggleBtn = document.getElementById('customToggleBtn');
        const customPanel = document.getElementById('customPanel');
        if (customToggleBtn && customPanel) {
            customToggleBtn.addEventListener('click', () => {
                const open = customPanel.hasAttribute('hidden');
                if (open) customPanel.removeAttribute('hidden'); else customPanel.setAttribute('hidden', '');
            });
        }
        const halloffameToggle = document.getElementById('halloffameToggle');
        const halloffamePanel = document.getElementById('halloffamePanel');
        if (halloffameToggle && halloffamePanel) {
            halloffameToggle.addEventListener('click', () => {
                const open = halloffamePanel.hasAttribute('hidden');
                if (open) halloffamePanel.removeAttribute('hidden'); else halloffamePanel.setAttribute('hidden', '');
            });
            halloffamePanel.addEventListener('click', (e) => {
                const btn = e.target.closest('.hof-ghost-btn');
                if (!btn) return;
                const id = Number(btn.getAttribute('data-ghost-id'));
                if (!Number.isNaN(id)) this.playGhost(id);
            });
        }
        const customImportBtn = document.getElementById('customImportBtn');
        const customJsonInput = document.getElementById('customJsonInput');
        if (customImportBtn && customJsonInput) {
            customImportBtn.addEventListener('click', () => this.importCustomLevel(customJsonInput.value));
        }

        const dailyPlayBtn = document.getElementById('dailyPlayBtn');
        if (dailyPlayBtn) dailyPlayBtn.addEventListener('click', () => this.playDailyChallenge());

        const notifyToggleBtn = document.getElementById('notifyToggleBtn');
        if (notifyToggleBtn) {
            notifyToggleBtn.addEventListener('click', () => {
                if (typeof Notification === 'undefined') return;
                if (this.notifyDailyEnabled) {
                    // Already on — this click turns it back off. No need to
                    // touch the browser permission, just stop reminding.
                    this.notifyDailyEnabled = false;
                    this.saveProgress();
                    this.renderNotifyButton();
                    return;
                }
                if (Notification.permission === 'granted') {
                    this.notifyDailyEnabled = true;
                    this.saveProgress();
                    this.renderNotifyButton();
                    this.fireDailyNotificationIfDue();
                } else if (Notification.permission !== 'denied') {
                    Notification.requestPermission().then((perm) => {
                        this.notifyDailyEnabled = perm === 'granted';
                        this.saveProgress();
                        this.renderNotifyButton();
                        if (perm === 'granted') this.fireDailyNotificationIfDue();
                    });
                }
            });
        }
        const surpriseBtn = document.getElementById('surpriseBtn');
        if (surpriseBtn) surpriseBtn.addEventListener('click', () => this.surpriseMe());
    }
};

// Theme: swap the palette by setting data-theme on <html>, persist it, and keep
// every .theme-select control in sync.
// "void" is a bonus theme unlocked by earning the "Root Wizard" achievement
// (own every machine) — see GAME.isThemeUnlocked(). Free themes are always
// available; this only ever adds, never takes away, from what v1.2 shipped.
window.UNLOCKABLE_THEMES = { void: 'root_wizard' };
window.setTheme = function(name) {
    const THEMES = ['kali', 'matrix', 'dracula', 'amber', 'light', 'void'];
    if (!THEMES.includes(name)) name = 'kali';
    if (!window.GAME || !window.GAME.isThemeUnlocked(name)) name = window.currentTheme || 'kali';
    if (!THEMES.includes(name)) name = 'kali'; // guard against a stale/tampered persisted value
    window.currentTheme = name;
    if (name === 'kali') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', name);
    document.querySelectorAll('.theme-select').forEach(s => { s.value = name; });
    if (window.GAME && window.GAME.saveProgress) window.GAME.saveProgress();
};

// Enable/label the locked-theme <option> once its unlock condition is met.
// Called at boot (after progress loads) and after every achievement check.
window.refreshThemeOptions = function() {
    document.querySelectorAll('.theme-select option.theme-opt-locked').forEach(opt => {
        const unlocked = window.GAME && window.GAME.isThemeUnlocked(opt.value);
        opt.disabled = !unlocked;
        opt.textContent = unlocked ? '◈ Void' : '🔒 Void';
    });
};

window.setLanguage = function(lang) {
    if (lang !== 'en' && lang !== 'fr' && lang !== 'es') return;
    window.currentLang = lang;
    document.querySelectorAll('.lang-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
    window.applyI18n();
    if (window.GAME && window.GAME.level) {
        window.GAME.renderMission();
        if (window.GAME.buildHomeGrid) window.GAME.buildHomeGrid();
        const winModal = document.getElementById('winModal');
        if (winModal && winModal.style.display === 'flex' && window.GAME.renderDebrief) {
            window.GAME.renderDebrief(window.GAME.level());
            if (window.GAME.renderKillChain) window.GAME.renderKillChain(window.GAME.level());
        }
        window.GAME.saveProgress();
    }
};

// PWA installability: Chrome/Edge suppress their own install UI unless the
// page calls prompt() on a captured beforeinstallprompt event, so without
// this the install path silently doesn't exist on those browsers. Captured
// at top level (not inside DOMContentLoaded) since the event can fire
// before that listener runs.
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById('installBtn');
    if (btn) btn.hidden = false;
});
window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btn = document.getElementById('installBtn');
    if (btn) btn.hidden = true;
});

document.addEventListener('DOMContentLoaded', () => {
    window.GAME.loadSave();
    window.setTheme(window.currentTheme || 'kali');
    if (window.refreshThemeOptions) window.refreshThemeOptions();
    if (window.SFX) window.SFX.init();
    if (window.WALKMODE) window.WALKMODE.init();
    if (window.MENTORMODE) window.MENTORMODE.init();
    if (window.BOXBUILDER) window.BOXBUILDER.init();
    if (window.BOXEDITOR) window.BOXEDITOR.init();
    document.querySelectorAll('.lang-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-lang') === window.currentLang);
    });
    window.applyI18n();
    window.GAME.boot();

    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredInstallPrompt) return;
            deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
            installBtn.hidden = true;
        });
    }

    // Foreground-only reminder (see fireDailyNotificationIfDue's comment) —
    // fires at most once per day, only if the player opted in earlier.
    try { window.GAME.fireDailyNotificationIfDue(); } catch (e) { /* Notification API unavailable/blocked — skip silently */ }
});
