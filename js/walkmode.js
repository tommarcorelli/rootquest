// walkmode.js — "Explanation mode" state (🎓).
//
// v1 was a toggle and nothing else: flip it on and the whole annotated
// solution appeared at once. That made it an answer sheet rather than a
// teaching aid — there is no way to peek at "what do I do next?" without
// also reading the ending.
//
// v2 keeps the same button but reveals the walkthrough one step at a time,
// per machine, remembering how far you got. Rendering still lives in
// main.js#renderWalkthrough(); this file owns the on/off state and the
// reveal cursor.
window.WALKMODE = {
    enabled: false,
    KEY: 'rootquest_walkmode',
    REVEAL_KEY: 'rootquest_walkreveal',

    // levelId -> number of steps revealed. Persisted so closing the tab
    // doesn't silently hand you back the full solution on the next visit.
    revealed: {},
    levelId: null,

    init() {
        try { this.enabled = localStorage.getItem(this.KEY) === 'on'; } catch (e) { this.enabled = false; }
        try { this.revealed = JSON.parse(localStorage.getItem(this.REVEAL_KEY) || '{}') || {}; } catch (e) { this.revealed = {}; }
        this.syncButtons();
    },

    toggle() {
        this.enabled = !this.enabled;
        try { localStorage.setItem(this.KEY, this.enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
        this.syncButtons();
        return this.enabled;
    },

    // Called on every level load. The cursor is per-machine, so replaying a
    // box you already spoiled doesn't re-hide what you've seen.
    setLevel(id) {
        this.levelId = id;
        if (this.revealed[id] === undefined) this.revealed[id] = 0;
    },

    count() { return this.revealed[this.levelId] || 0; },

    // Returns true if anything new was actually revealed, so the caller knows
    // whether to re-render.
    revealNext(total) {
        if (this.levelId === null) return false;
        const now = this.count();
        if (now >= total) return false;
        this.revealed[this.levelId] = now + 1;
        this.persist();
        return true;
    },

    revealAll(total) {
        if (this.levelId === null) return false;
        if (this.count() >= total) return false;
        this.revealed[this.levelId] = total;
        this.persist();
        return true;
    },

    persist() {
        try { localStorage.setItem(this.REVEAL_KEY, JSON.stringify(this.revealed)); } catch (e) { /* ignore */ }
    },

    // A step counts as done once its command has been run, matched on the
    // command word plus the distinctive part of the arguments rather than the
    // exact string — players legitimately vary paths, quoting and redirection.
    signature(cmd) {
        return String(cmd || '')
            .replace(/2>\s*\/dev\/null/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    },

    wasRun(cmd, history) {
        const sig = this.signature(cmd);
        if (!sig) return false;
        const head = sig.split(' ').slice(0, 2).join(' ');
        return (history || []).some(h => {
            const hs = this.signature(h);
            return hs === sig || (head.includes(' ') && hs.startsWith(head));
        });
    },

    syncButtons() {
        document.querySelectorAll('.explain-btn').forEach(b => {
            b.setAttribute('aria-pressed', String(this.enabled));
            b.classList.toggle('is-on', this.enabled);
        });
    }
};
