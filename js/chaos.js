// chaos.js — "Chaos" mode (🌪️): the box fights back.
//
// Every other mode changes what *you* are allowed to do. Chaos changes what
// the *machine* does while you work: it's a live host with a jumpy admin and
// housekeeping jobs that don't care that you're mid-exploit. The pressure is
// environmental, not informational — you keep your hints and your cheatsheet,
// but the ground moves under you.
//
// Three rules keep it a challenge and not a coin-flip:
//
//   • It never touches the vulnerability. The way in is always still there;
//     Chaos attacks your *staging* and your *continuity*, not the box's flaw.
//   • It only ever removes files YOU created, in scratch space (/tmp), that
//     have gone cold (untouched for GRACE commands). Your active staging is
//     safe — the lesson is "stage and use it now", not "roll the dice".
//   • Every event is announced before and after, and telegraphed by an
//     escalating threat level, so nothing that costs you happens silently.
//
// The star event is the tmp reaper: a real Linux hazard (systemd-tmpfiles /
// tmpreaper) that privesc write-ups genuinely warn about, and the one that
// bites exactly the workflow — drop a fake binary in /tmp, then trigger a
// SUID helper or PATH hijack — where it teaches something.
//
// Inert unless MODES.is('chaos'); a normal run never sees any of it.
window.CHAOS = {
    GRACE: 4,        // commands a staged /tmp file survives before it can be swept
    REAP_EVERY: 5,   // the housekeeping job runs on this cadence
    RESET_AUTH_AT: 12, // command count at which the sudo ticket is dropped once

    level: 0,        // threat level 0..3, drives the HUD and the flavour
    reaped: 0,       // files swept this machine (shown on the scorecard)
    seen: {},        // /tmp path -> cmdCount when first observed
    original: null,  // Set of FS paths present at level load
    firedAuth: false,
    firedIntro: false,

    resetForLevel() {
        this.level = 0;
        this.reaped = 0;
        this.seen = {};
        this.original = null;
        this.firedAuth = false;
        this.firedIntro = false;
        this.render();
    },

    active() {
        return !!(window.MODES && window.MODES.is('chaos'))
            && window.SESSION && !SESSION.isRoot && !SESSION.blueTeam && !SESSION.ghostReplaying;
    },

    // Snapshotting the original tree lets the reaper tell *your* scratch files
    // apart from whatever the box shipped with — it must never sweep the
    // latter, and it must never sweep the vulnerability.
    snapshot() {
        if (this.original) return;
        this.original = new Set(Object.keys((window.FS && FS._tree) || {}));
    },

    // Files the reaper is allowed to take: player-owned, under /tmp, created
    // this session, and cold (untouched for at least GRACE commands).
    reapable(cmds) {
        if (!window.FS) return [];
        const out = [];
        const dir = FS.get('/tmp');
        if (!dir || !Array.isArray(dir.children)) return out;
        for (const name of dir.children) {
            const path = '/tmp/' + name;
            const node = FS.get(path);
            if (!node || node.type === 'dir') continue;
            if (this.original && this.original.has(path)) continue; // shipped with the box
            const born = this.seen[path];
            if (born === undefined) continue;
            if (node.owner && node.owner !== SESSION.user && node.owner !== 'player') continue;
            if (cmds - born >= this.GRACE) out.push(path);
        }
        return out;
    },

    // Track new /tmp files as they appear so their age is known when the
    // housekeeping job next runs.
    noteTmp(cmds) {
        if (!window.FS) return;
        const dir = FS.get('/tmp');
        if (!dir || !Array.isArray(dir.children)) return;
        for (const name of dir.children) {
            const path = '/tmp/' + name;
            if (this.original && this.original.has(path)) continue;
            if (this.seen[path] === undefined) this.seen[path] = cmds;
        }
    },

    onCommand(raw, outLines) {
        void raw; void outLines;
        if (!this.active()) return;
        this.snapshot();
        const cmds = (window.SESSION && SESSION.cmdCount) || 0;

        if (!this.firedIntro) {
            this.firedIntro = true;
            this.say('🌪️', {
                en: 'HIDS online. A watchdog is now cleaning scratch space and an admin is on shift — anything you leave lying around in /tmp will not last. Stage and strike.',
                fr: 'HIDS en ligne. Un watchdog nettoie désormais les espaces temporaires et un admin est de garde — rien de ce que tu laisses traîner dans /tmp ne durera. Prépare et frappe.',
                es: 'HIDS en línea. Un watchdog limpia ahora el espacio temporal y hay un admin de guardia — nada de lo que dejes en /tmp durará. Prepara y ataca.'
            }, 'warn');
        }

        this.noteTmp(cmds);

        // The housekeeping job: sweep cold scratch files on its cadence.
        if (cmds > 0 && cmds % this.REAP_EVERY === 0) {
            const victims = this.reapable(cmds);
            if (victims.length) {
                for (const path of victims) { FS.remove(path); delete this.seen[path]; }
                this.reaped += victims.length;
                this.bump();
                this.say('🧽', {
                    en: `tmpreaper swept ${victims.length} stale file(s): ${victims.join(', ')}. Left something half-built? It's gone — rebuild it and use it right away.`,
                    fr: `tmpreaper a balayé ${victims.length} fichier(s) obsolète(s) : ${victims.join(', ')}. Un truc à moitié préparé ? Envolé — reconstruis-le et sers-t'en tout de suite.`,
                    es: `tmpreaper barrió ${victims.length} archivo(s) obsoleto(s): ${victims.join(', ')}. ¿Algo a medio montar? Desapareció — reconstrúyelo y úsalo enseguida.`
                }, 'err');
                if (window.SFX && window.SFX.error) window.SFX.error();
            }
        }

        // The admin drops your cached sudo ticket once, mid-run: your next
        // sudo re-prompts, exactly as if someone had run `sudo -k` on you.
        if (!this.firedAuth && cmds >= this.RESET_AUTH_AT) {
            this.firedAuth = true;
            if (window.SESSION) SESSION.sudoAuthed = false;
            this.bump();
            this.say('🔒', {
                en: 'Admin activity detected — your sudo ticket was revoked. The next sudo will ask for a password again.',
                fr: "Activité admin détectée — ton ticket sudo a été révoqué. Le prochain sudo redemandera un mot de passe.",
                es: 'Actividad de admin detectada — tu ticket de sudo fue revocado. El próximo sudo volverá a pedir contraseña.'
            }, 'warn');
        }

        this.render();
    },

    bump() { this.level = Math.min(3, this.level + 1); },

    // Chaos survived cleanly is worth saying on the scorecard.
    grade() {
        if (this.reaped === 0) return 'UNTOUCHED';
        if (this.reaped <= 2) return 'RATTLED';
        return 'HARRIED';
    },

    say(icon, msg, cls) {
        if (!window.TERM || !msg) return;
        const text = msg[window.currentLang] || msg.en;
        window.TERM.print([{ text: `${icon} ${text}`, cls: cls || 'dim' }]);
        if (window.TERM.scrollToBottom) window.TERM.scrollToBottom();
    },

    render() {
        if (typeof document === 'undefined') return;
        const box = document.getElementById('chaosHud');
        if (!box) return;
        const on = !!(window.MODES && window.MODES.is('chaos'));
        box.style.display = on ? '' : 'none';
        if (!on) return;
        const bar = document.getElementById('chaosLevel');
        if (bar) {
            const pct = [8, 40, 70, 100][this.level] || 8;
            bar.style.width = pct + '%';
            bar.className = 'chaos-fill' + (this.level >= 3 ? ' is-hot' : this.level >= 2 ? ' is-warm' : '');
        }
        const reap = document.getElementById('chaosReaped');
        if (reap) reap.textContent = String(this.reaped);
    }
};

// Same observer pattern as stealth.js/mentor.js: wrap the single command
// entry point and never change what it returns.
if (window.CMD && window.CMD.execute) {
    const _origExecute = window.CMD.execute.bind(window.CMD);
    window.CMD.execute = function(raw) {
        const out = _origExecute(raw);
        try { window.CHAOS.onCommand(raw, out); } catch (e) { /* chaos is best-effort, never breaks the game */ }
        return out;
    };
}
