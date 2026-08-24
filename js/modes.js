// modes.js — central registry for rootQuest's game modes.
//
// Before this file, every "mode" was its own free-floating global with its own
// localStorage key and its own topbar button (WALKMODE, MENTORMODE). That
// works for two, not for a shelf of them: nothing said which could be on at
// once, nothing gated assistance, nothing told the scorecard a run was harder.
//
// The model, in three layers:
//
//   • ASSIST modes (🎓 explanation, 🧭 mentor) — independent toggles, any
//     combination, they only ever *add* help. Owned by walkmode.js /
//     mentormode.js; this file only decides whether they're *allowed*.
//   • MODIFIERS (🕵️ stealth, 🕶️ hardcore, ⏱️ time attack, 🌪️ chaos) — the
//     challenge modes, and as of v1.39 they COMPOSE: any subset can be on at
//     once. Stealth + time attack is "noisy and rushed"; hardcore + chaos is
//     "no net, and the floor is moving". Their score multipliers multiply and
//     their assistance rules AND together, so the registry answers one
//     question per concern and callers never enumerate combinations.
//   • SESSION modes (📜 exam) — a whole multi-box sitting with its own clock
//     and rules. Mutually exclusive with the modifier set (an exam dictates
//     its own constraints), so while one runs the modifiers are suppressed
//     rather than destroyed — leaving the exam brings them straight back.
//
// Everything is inert until the player turns something on: no modifiers and no
// session is "normal", the default, and plays exactly as it did before any of
// this existed.
window.MODES = {
    KEY: 'rootquest_modes',       // persisted modifier set (array of ids)
    LEGACY_KEY: 'rootquest_mode', // the old single-string key, migrated once

    // Definitions, including the two non-modifier pseudo-modes (normal / exam)
    // so label/desc/icon lookups have a home for them too.
    CHALLENGES: [
        { id: 'normal',    icon: '🎯', mult: 1,    assist: true,  modifier: false },
        { id: 'stealth',   icon: '🕵️', mult: 1.5,  assist: true,  modifier: true  },
        { id: 'hardcore',  icon: '🕶️', mult: 2,    assist: false, modifier: true  },
        { id: 'timeattack', icon: '⏱️', mult: 1.75, assist: true,  modifier: true  },
        { id: 'chaos',     icon: '🌪️', mult: 2,    assist: true,  modifier: true  },
        { id: 'exam',      icon: '📜', mult: 2.5,  assist: false, session: true   }
    ],

    active: null,     // Set of active modifier ids (empty = normal)
    session: null,    // 'exam' | null — overrides the modifier set while set

    init() {
        this.active = new Set();
        try {
            const saved = localStorage.getItem(this.KEY);
            if (saved) {
                for (const id of JSON.parse(saved)) if (this.isModifier(id)) this.active.add(id);
            } else {
                // One-time migration from the pre-composition single-string key.
                const legacy = localStorage.getItem(this.LEGACY_KEY);
                if (legacy && this.isModifier(legacy)) this.active.add(legacy);
            }
        } catch (e) { this.active = new Set(); }
        this.sync();
    },

    get(id) { return this.CHALLENGES.find(m => m.id === id) || null; },

    isModifier(id) { const d = this.get(id); return !!(d && d.modifier); },

    // Modes the hub picker offers: normal (clears everything) plus the four
    // modifiers. Session modes have their own entry point.
    pickable() { return this.CHALLENGES.filter(m => m.session !== true); },
    modifiers() { return this.CHALLENGES.filter(m => m.modifier); },

    // The one question every caller asks. A session overrides the set, so a
    // modifier reports inactive while an exam runs (its own constraints win).
    is(id) {
        if (!this.active) this.active = new Set();
        if (id === 'exam') return this.session === 'exam';
        if (id === 'normal') return !this.session && this.active.size === 0;
        if (this.session) return false;
        return this.active.has(id);
    },

    // Toggle a modifier on the hub. No-op while a session is running — the
    // picker is disabled then anyway, this just makes the rule explicit.
    toggle(id) {
        if (!this.isModifier(id) || this.session) return false;
        if (this.active.has(id)) this.active.delete(id); else this.active.add(id);
        this.persist();
        this.sync();
        return this.active.has(id);
    },

    // Legacy single-select entry point, still used by a few callers and by the
    // tests: 'normal' clears the set, a modifier makes it the only one active,
    // a session id enters that session.
    set(id) {
        const def = this.get(id);
        if (!def) return false;
        if (def.session) return this.enterSession(id);
        this.active = new Set(def.modifier ? [id] : []);
        this.persist();
        this.sync();
        return true;
    },

    enterSession(id) {
        const def = this.get(id);
        if (!def || !def.session) return false;
        this.session = id;
        this.sync();
        return true;
    },

    // Leaving a session restores the modifier set untouched — entering never
    // cleared it, only masked it.
    exitSession() {
        this.session = null;
        this.sync();
    },

    persist() {
        try { localStorage.setItem(this.KEY, JSON.stringify([...this.active])); } catch (e) { /* ignore */ }
    },

    // ── Composed rules the rest of the game asks about ──────────────────
    // Assistance is allowed only if *nothing* active forbids it (AND), and the
    // multiplier is the product of everything active (a harder run pays more).

    activeDefs() {
        if (this.session) return [this.get(this.session)];
        return [...this.active].map(id => this.get(id)).filter(Boolean);
    },

    assistAllowed() {
        return this.activeDefs().every(d => d.assist !== false);
    },

    multiplier() {
        const defs = this.activeDefs();
        if (!defs.length) return 1;
        return defs.reduce((m, d) => m * (d.mult || 1), 1);
    },

    TIME_BUDGET: { EASY: 180, MEDIUM: 300, HARD: 480, CUSTOM: 300 },
    timeBudget(tier) {
        if (!this.is('timeattack')) return 0;
        return this.TIME_BUDGET[tier] || this.TIME_BUDGET.CUSTOM;
    },

    stealthActive() { return this.is('stealth'); },

    label(id) {
        if (id) return window.t ? window.t('mode_' + id) : id;
        // Composite label for the pill: the single mode's name, or a count.
        if (this.session) return window.t ? window.t('mode_' + this.session) : this.session;
        if (this.active.size === 0) return window.t ? window.t('mode_normal') : 'normal';
        if (this.active.size === 1) { const only = [...this.active][0]; return window.t ? window.t('mode_' + only) : only; }
        return window.t ? window.t('modeStack', this.active.size) : (this.active.size + ' modes');
    },
    desc(id) { return window.t ? window.t('modeDesc_' + id) : ''; },

    // Icons for the pill: the session's, or every active modifier's, or 🎯.
    icons() {
        if (this.session) return this.get(this.session).icon;
        if (this.active.size === 0) return '🎯';
        return this.modifiers().filter(m => this.active.has(m.id)).map(m => m.icon).join('');
    },

    // ── UI sync ─────────────────────────────────────────────────────────
    sync() {
        if (typeof document === 'undefined') return;
        document.querySelectorAll('.mode-card').forEach(card => {
            const on = this.is(card.getAttribute('data-mode'));
            card.classList.toggle('is-active', on);
            card.setAttribute('aria-pressed', String(on));
        });
        const pill = document.getElementById('modePill');
        if (pill) {
            const challenge = !this.is('normal');
            pill.textContent = `${this.icons()} ${this.label()}`;
            pill.classList.toggle('is-challenge', challenge);
            pill.setAttribute('data-mode', this.session || [...(this.active || [])].join(' ') || 'normal');
        }
        const assist = this.assistAllowed();
        ['hintBtn', 'explainBtn', 'mentorBtn'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = assist ? '' : 'none';
        });
        document.body.classList.toggle('no-assist', !assist);
        const rootEl = document.documentElement;
        if (rootEl && rootEl.setAttribute) rootEl.setAttribute('data-mode', this.session || (this.active && this.active.size ? 'challenge' : 'normal'));
    }
};
