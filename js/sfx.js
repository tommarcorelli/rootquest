// sfx.js — synthesized terminal sound effects (Web Audio, zero assets).
// Opt-in: muted by default, toggled by the speaker button, persisted in localStorage.
window.SFX = {
    ctx: null,
    muted: true,
    KEY: 'rootquest_sound',

    init() {
        try { this.muted = localStorage.getItem(this.KEY) !== 'on'; } catch (e) { this.muted = true; }
        this.syncButtons();
    },

    // AudioContext can only start after a user gesture, so create it lazily.
    _ac() {
        if (this.muted) return null;
        try {
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return null;
                this.ctx = new AC();
            }
            if (this.ctx.state === 'suspended') this.ctx.resume();
            return this.ctx;
        } catch (e) {
            return null;
        }
    },

    _tone(freq, dur, type = 'square', gain = 0.05, when = 0) {
        const ac = this._ac();
        if (!ac) return;
        const t = ac.currentTime + when;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g); g.connect(ac.destination);
        osc.start(t); osc.stop(t + dur + 0.02);
    },

    key() { this._tone(420 + Math.random() * 120, 0.03, 'square', 0.025); },
    enter() { this._tone(300, 0.05, 'square', 0.04); },
    error() { this._tone(150, 0.16, 'sawtooth', 0.05); this._tone(110, 0.2, 'sawtooth', 0.04, 0.04); },
    win() {
        // ascending arpeggio → "root obtained"
        [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.18, 'triangle', 0.06, i * 0.09));
    },

    toggle() {
        this.muted = !this.muted;
        try { localStorage.setItem(this.KEY, this.muted ? 'off' : 'on'); } catch (e) { /* ignore */ }
        this.syncButtons();
        if (!this.muted) this.enter(); // audible confirmation when enabling
        return !this.muted;
    },

    syncButtons() {
        document.querySelectorAll('.sound-btn').forEach(b => {
            b.textContent = this.muted ? '🔇' : '🔊';
            b.setAttribute('aria-pressed', String(!this.muted));
            b.classList.toggle('is-on', !this.muted);
        });
    }
};
