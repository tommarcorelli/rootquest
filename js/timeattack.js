// timeattack.js — "Time attack" mode (⏱️).
//
// A countdown sized to the machine's difficulty tier (MODES.TIME_BUDGET).
// The clock exists to change how you *look* at a box: with three minutes on
// the screen you stop reading every file and start going straight for the
// three checks that actually matter.
//
// When it runs out the run is marked out-of-time rather than snatched away:
// the terminal keeps working, but the time-attack multiplier is gone and the
// scorecard says so. Deleting a player's half-finished work to make a point
// is the one thing a training game should never do — `reset` is right there
// if they want a clean attempt.
//
// Inert unless MODES.is('timeattack'); a normal run never starts a timer.
window.TIMEATTACK = {
    budget: 0,        // seconds allotted for the current machine
    remaining: 0,
    expired: false,
    _iv: null,
    _warned: [],
    WARN_AT: [60, 10], // seconds remaining that trigger a spoken warning

    // Pure: how long this machine is worth. Split out so tests can check the
    // tier mapping without a clock or a DOM.
    budgetFor(idx) {
        if (!window.MODES) return 0;
        const meta = (window.MACHINE_META && window.MACHINE_META[idx]) || {};
        return window.MODES.timeBudget(meta.diff || 'CUSTOM');
    },

    startForLevel(idx) {
        this.stop();
        this.expired = false;
        this._warned = [];
        this.budget = this.budgetFor(idx);
        this.remaining = this.budget;
        this.render();
        if (!this.budget) return;
        if (typeof setInterval !== 'function') return;
        this._iv = setInterval(() => this.tick(), 1000);
    },

    stop() {
        if (this._iv) { clearInterval(this._iv); this._iv = null; }
    },

    tick() {
        if (!this.budget || this.expired) return;
        // A finished box stops the clock: the timer measures the hunt, not
        // how long the victory modal stays open.
        if (window.SESSION && (window.SESSION.isRoot || window.SESSION.blueTeam)) { this.stop(); return; }
        this.remaining = Math.max(0, this.remaining - 1);
        for (const w of this.WARN_AT) {
            if (this.remaining === w && !this._warned.includes(w)) {
                this._warned.push(w);
                this.say('⏱️', {
                    en: `${w} seconds left.`,
                    fr: `${w} secondes restantes.`,
                    es: `${w} segundos restantes.`
                }, 'warn');
            }
        }
        if (this.remaining === 0) this.expire();
        this.render();
    },

    expire() {
        this.expired = true;
        this.stop();
        this.say('⌛', {
            en: 'OUT OF TIME. The box is still yours to finish, but this run no longer counts as a time attack — type `reset` for a clean attempt.',
            fr: 'TEMPS ÉCOULÉ. Tu peux toujours finir la box, mais ce run ne compte plus comme contre-la-montre — tape `reset` pour repartir à zéro.',
            es: 'TIEMPO AGOTADO. Aún puedes terminar la máquina, pero este intento ya no cuenta como contrarreloj — escribe `reset` para empezar de cero.'
        }, 'err');
        if (window.SFX && window.SFX.error) window.SFX.error();
    },

    // The scorecard asks this: an expired clock forfeits the mode bonus.
    multiplierPenalty() {
        return (this.budget && this.expired) ? 1 : 0;
    },

    say(icon, msg, cls) {
        if (!window.TERM || !msg) return;
        const text = msg[window.currentLang] || msg.en;
        window.TERM.print([{ text: `${icon} ${text}`, cls: cls || 'dim' }]);
        if (window.TERM.scrollToBottom) window.TERM.scrollToBottom();
    },

    format(sec) {
        const mm = String(Math.floor(sec / 60)).padStart(2, '0');
        const ss = String(sec % 60).padStart(2, '0');
        return `${mm}:${ss}`;
    },

    render() {
        if (typeof document === 'undefined') return;
        const box = document.getElementById('timerBox');
        if (!box) return;
        box.style.display = this.budget ? '' : 'none';
        if (!this.budget) return;
        const val = document.getElementById('timerValue');
        if (val) {
            val.textContent = this.format(this.remaining);
            val.className = 'timer-value' + (this.expired ? ' is-out' : this.remaining <= 30 ? ' is-hot' : this.remaining <= 60 ? ' is-warm' : '');
        }
    }
};
