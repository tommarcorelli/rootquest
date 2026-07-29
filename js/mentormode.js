// mentormode.js — "Mentor mode" toggle state. Off by default, persisted in
// localStorage, mirrors the walkmode.js/sfx.js pattern. Purely a UI/state
// concern: the actual coaching logic lives in js/mentor.js.
window.MENTORMODE = {
    enabled: false,
    KEY: 'rootquest_mentormode',

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
        document.querySelectorAll('.mentor-btn').forEach(b => {
            b.setAttribute('aria-pressed', String(this.enabled));
            b.classList.toggle('is-on', this.enabled);
        });
    }
};
