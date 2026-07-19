// walkmode.js — "Explanation mode" toggle state. Off by default, persisted
// in localStorage, mirrors the sound-btn pattern in sfx.js. Purely a UI
// concern: rendering the actual steps is main.js#renderWalkthrough(), using
// data from window.WALKTHROUGHS.
window.WALKMODE = {
    enabled: false,
    KEY: 'rootquest_walkmode',

    init() {
        try { this.enabled = localStorage.getItem(this.KEY) === 'on'; } catch (e) { this.enabled = false; }
        this.syncButtons();
    },

    toggle() {
        this.enabled = !this.enabled;
        try { localStorage.setItem(this.KEY, this.enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
        this.syncButtons();
        return this.enabled;
    },

    syncButtons() {
        document.querySelectorAll('.explain-btn').forEach(b => {
            b.setAttribute('aria-pressed', String(this.enabled));
            b.classList.toggle('is-on', this.enabled);
        });
    }
};
