// exam.js — "Certification exam" mode (📜), OSCP-shaped.
//
// Every other mode in this game is scoped to one machine. An exam isn't: it's
// three boxes, one clock that never stops, no assistance of any kind, and a
// report at the end that says pass or fail. That's a different unit of work,
// and it's the one that actually rehearses a certification — the skill an
// exam tests is not "can you root this box" but "can you allocate four hours
// across three boxes you've never triaged, and know when to walk away from
// one".
//
// Three design decisions worth stating, because they're the ones that make it
// feel like an exam rather than a playlist:
//
//   • The clock is wall-clock, anchored to a stored timestamp. Closing the
//     tab does not pause it. That's the whole point — an exam you can pause
//     is a practice session.
//   • The board is drawn from a seed and mixes tiers (one ENTRY, one
//     INTERMEDIATE, one ADVANCED). Three random boxes could hand you three
//     easy ones; a real exam never does, and the triage decision only exists
//     when the boxes are unequal.
//   • Points are per tier and the pass mark sits at 50/90, so exactly two
//     boxes pass and one never does — no matter which two. Rooting the hard
//     box first is worth more, but it isn't a shortcut.
//
// The exam owns no exploit logic: boxes are played through the ordinary game
// path. This file only decides which boxes, how long, what counts, and what
// the report says.
window.EXAM = {
    KEY: 'rootquest_exam',

    // Four hours. Long enough that triage matters, short enough to be one
    // sitting. Real OSCP is 23h45; this is the training-sized version.
    DURATION: 4 * 60 * 60,

    // Points per tier, and the mark you need. 20+30+40 = 90 possible;
    // 50 to pass means any two boxes clear it and any one box doesn't.
    POINTS: { EASY: 20, MEDIUM: 30, HARD: 40, CUSTOM: 30, ROGUE: 30 },
    PASS_MARK: 50,
    BOARD_TIERS: ['EASY', 'MEDIUM', 'HARD'],

    // ── State ───────────────────────────────────────────────────────────
    active: false,
    seed: null,
    startedAt: 0,       // epoch ms, the anchor the clock is derived from
    board: [],          // [{ id, tier, points }]
    results: {},        // level id -> { rooted: true, at: epoch ms, seconds }
    finished: false,
    _iv: null,

    // ── Seeded board selection ──────────────────────────────────────────
    // Same RNG as rogue.js so a shared exam seed reproduces the same board
    // anywhere. Built-in boxes only: custom and rogue boxes live in one
    // browser's localStorage, so including them would make a seed mean
    // different things to different people.
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

    parseSeed(text) {
        if (window.ROGUE && window.ROGUE.parseSeed) return window.ROGUE.parseSeed(text);
        return Math.abs(parseInt(text, 16) || 0) >>> 0;
    },

    formatSeed(seed) { return (seed >>> 0).toString(16).padStart(6, '0'); },

    randomSeed() {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0;
        }
        return Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
    },

    // Pure: seed -> board. One box per tier, in tier order, so the player
    // always knows which of the three is the 40-pointer.
    buildBoard(seed) {
        const rnd = this.rng(seed);
        const board = [];
        for (const tier of this.BOARD_TIERS) {
            const pool = (window.LEVELS || []).filter((l, i) =>
                !l.custom && ((window.MACHINE_META && window.MACHINE_META[i] && window.MACHINE_META[i].diff) === tier));
            if (!pool.length) continue;
            const lvl = pool[Math.floor(rnd() * pool.length) % pool.length];
            board.push({ id: lvl.id, tier, points: this.POINTS[tier] || 0 });
        }
        return board;
    },

    // ── Lifecycle ───────────────────────────────────────────────────────
    start(seedText) {
        const seed = (seedText === undefined || seedText === null || seedText === '')
            ? this.randomSeed()
            : this.parseSeed(seedText);
        const board = this.buildBoard(seed);
        if (board.length < this.BOARD_TIERS.length) {
            return { ok: false, reason: 'board' };
        }
        this.active = true;
        this.finished = false;
        this.seed = seed;
        this.board = board;
        this.results = {};
        this.startedAt = Date.now();
        this.persist();
        this.tick();
        this.startClock();
        return { ok: true, seed: this.formatSeed(seed), board };
    },

    // Restores an exam in progress across a reload. An exam whose clock ran
    // out while the tab was closed comes back already finished — the report
    // is still there, the time is not.
    restore() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { saved = null; }
        if (!saved || !saved.active || !Array.isArray(saved.board) || !saved.board.length) return false;
        this.active = true;
        this.seed = saved.seed;
        this.board = saved.board;
        this.results = saved.results || {};
        this.startedAt = saved.startedAt || Date.now();
        this.finished = !!saved.finished;
        if (this.remaining() <= 0) this.finished = true;
        if (!this.finished) this.startClock();
        return true;
    },

    abandon() {
        this.active = false;
        this.finished = false;
        this.board = [];
        this.results = {};
        this.stopClock();
        try { localStorage.removeItem(this.KEY); } catch (e) { /* ignore */ }
        this.render();
    },

    persist() {
        try {
            localStorage.setItem(this.KEY, JSON.stringify({
                active: this.active, seed: this.seed, board: this.board,
                results: this.results, startedAt: this.startedAt, finished: this.finished
            }));
        } catch (e) { /* exam still runs this session, just won't survive a reload */ }
    },

    // ── Clock ───────────────────────────────────────────────────────────
    remaining() {
        if (!this.active || !this.startedAt) return 0;
        const elapsed = Math.floor((Date.now() - this.startedAt) / 1000);
        return Math.max(0, this.DURATION - elapsed);
    },

    elapsed() {
        if (!this.startedAt) return 0;
        return Math.min(this.DURATION, Math.floor((Date.now() - this.startedAt) / 1000));
    },

    startClock() {
        this.stopClock();
        if (typeof setInterval !== 'function') return;
        this._iv = setInterval(() => this.tick(), 1000);
    },

    stopClock() {
        if (this._iv) { clearInterval(this._iv); this._iv = null; }
    },

    tick() {
        if (!this.active || this.finished) return;
        if (this.remaining() <= 0) { this.finish('timeout'); return; }
        this.render();
    },

    // ── Scoring ─────────────────────────────────────────────────────────
    // A box only counts if it was rooted *while the exam was live*. Boxes
    // you owned before the exam started are worth nothing — otherwise the
    // exam would be a formality for anyone who'd already cleared the lab.
    onBoxRooted(levelId) {
        if (!this.active || this.finished) return false;
        const entry = this.board.find(b => b.id === levelId);
        if (!entry || this.results[levelId]) return false;
        this.results[levelId] = { rooted: true, at: Date.now(), seconds: this.elapsed() };
        this.persist();
        this.render();
        if (this.board.every(b => this.results[b.id])) this.finish('cleared');
        return true;
    },

    score() {
        return this.board.reduce((n, b) => n + (this.results[b.id] ? b.points : 0), 0);
    },

    maxScore() {
        return this.board.reduce((n, b) => n + b.points, 0);
    },

    passed() { return this.score() >= this.PASS_MARK; },

    finish(reason) {
        if (this.finished) return;
        this.finished = true;
        this.finishReason = reason || 'ended';
        this.stopClock();
        this.persist();
        this.render();
        if (window.GAME && window.GAME.showExamReport) window.GAME.showExamReport();
    },

    // Whether a given level index is part of the current board — used to keep
    // the player on their own exam boxes rather than wandering the hub.
    isBoardLevel(levelId) {
        return this.active && this.board.some(b => b.id === levelId);
    },

    // ── Report ──────────────────────────────────────────────────────────
    // Plain data, so the modal, the Markdown export and the tests all read
    // the same thing rather than three near-copies of the same formatting.
    report() {
        const rows = this.board.map(b => {
            const lvl = (window.LEVELS || []).find(l => l.id === b.id);
            const res = this.results[b.id];
            return {
                id: b.id,
                codename: lvl ? lvl.codename : String(b.id),
                title: lvl ? (lvl.title[window.currentLang] || lvl.title.en) : '',
                tier: b.tier,
                points: b.points,
                earned: res ? b.points : 0,
                rooted: !!res,
                at: res ? res.seconds : null,
                flag: res && lvl ? lvl.flag : null
            };
        });
        return {
            seed: this.formatSeed(this.seed),
            startedAt: this.startedAt,
            duration: this.DURATION,
            elapsed: this.elapsed(),
            rows,
            score: this.score(),
            max: this.maxScore(),
            passMark: this.PASS_MARK,
            passed: this.passed(),
            reason: this.finishReason || 'ended'
        };
    },

    fmt(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },

    // A Markdown report, because that's the artefact a real exam produces and
    // the format a portfolio or a write-up can actually use.
    markdown() {
        const r = this.report();
        const date = new Date(r.startedAt).toISOString().slice(0, 16).replace('T', ' ');
        const lines = [
            `# rootQuest — Exam Report`,
            '',
            `- **Seed:** \`${r.seed}\``,
            `- **Started:** ${date} UTC`,
            `- **Time used:** ${this.fmt(r.elapsed)} / ${this.fmt(r.duration)}`,
            `- **Result:** ${r.passed ? 'PASS' : 'FAIL'} — ${r.score}/${r.max} points (pass mark ${r.passMark})`,
            '',
            '| # | Machine | Tier | Points | Rooted | Time | Flag |',
            '|---|---|---|---|---|---|---|'
        ];
        r.rows.forEach((row, i) => {
            lines.push(`| ${i + 1} | \`${row.codename}\` | ${row.tier} | ${row.earned}/${row.points} | ${row.rooted ? '✅' : '❌'} | ${row.at !== null ? this.fmt(row.at) : '—'} | ${row.flag ? '`' + row.flag + '`' : '—'} |`);
        });
        lines.push('', '---', '', `Generated by rootQuest. Reproduce this exam board with seed \`${r.seed}\`.`);
        return lines.join('\n');
    },

    // ── HUD ─────────────────────────────────────────────────────────────
    render() {
        if (typeof document === 'undefined') return;
        const box = document.getElementById('examHud');
        if (!box) return;
        box.style.display = this.active ? '' : 'none';
        if (!this.active) return;
        const clock = document.getElementById('examClock');
        if (clock) {
            const left = this.remaining();
            clock.textContent = this.fmt(left);
            clock.className = 'exam-clock' + (this.finished ? ' is-out' : left <= 300 ? ' is-hot' : left <= 1800 ? ' is-warm' : '');
        }
        const score = document.getElementById('examScore');
        if (score) score.textContent = `${this.score()}/${this.maxScore()}`;
        const list = document.getElementById('examBoard');
        if (list) {
            list.innerHTML = this.board.map((b, i) => {
                const done = !!this.results[b.id];
                const lvl = (window.LEVELS || []).find(l => l.id === b.id);
                const name = lvl ? lvl.codename : b.id;
                return `<li class="exam-box${done ? ' is-done' : ''}">` +
                    `<span class="exam-box-n">${i + 1}</span>` +
                    `<span class="exam-box-name">${name}</span>` +
                    `<span class="exam-box-pts">${done ? b.points : '—'}/${b.points}</span></li>`;
            }).join('');
        }
    }
};
