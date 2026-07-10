// Main game orchestration
window.GAME = {
    currentLevel: 0,   // index into LEVELS
    completed: [],     // level ids completed

    level() { return LEVELS[this.currentLevel]; },

    boot() {
        TERM.init();
        this.loadLevel(0);
        this.buildLevelsMap();
        this.wireUi();
    },

    loadLevel(idx) {
        this.currentLevel = idx;
        const lvl = LEVELS[idx];
        // Reset session
        SESSION.user = lvl.user;
        SESSION.host = lvl.host;
        SESSION.cwd = lvl.cwd;
        SESSION.env = { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' };
        SESSION.isRoot = false;
        SESSION.hintIndex = 0;
        SESSION.pendingCron = false;
        SESSION.cronPayload = null;
        document.body.classList.remove('is-root');

        // Load filesystem for level
        FS.load(lvl);

        // Reset terminal
        TERM.outputEl.innerHTML = '';
        TERM.updatePrompt();

        // Render mission card
        this.renderMission();

        // Welcome banner + level intro
        const welcome = t('welcome');
        for (const line of welcome) {
            TERM.print([{ text: line, cls: line.trim().startsWith('rootQuest') ? 'ok' : (line.includes('│') || line.includes('╭') || line.includes('╰') ? 'info' : '') }]);
        }
        TERM.print([
            { text: `━━━ ${lvl.title[currentLang]} ━━━`, cls: 'flag' },
            { text: lvl.brief[currentLang], cls: 'dim' },
            { text: '', cls: '' }
        ]);
        TERM.scrollToBottom();

        this.updateLevelsMap();
        document.getElementById('levelNum').textContent = lvl.id;
        document.getElementById('termTitle').textContent = `${lvl.user}@${lvl.host}: ~`;
        this.updateProgress();
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
    },

    buildLevelsMap() {
        const map = document.getElementById('levelsMap');
        map.innerHTML = '';
        for (let i = 0; i < LEVELS.length; i++) {
            const node = document.createElement('div');
            node.className = 'level-node';
            node.textContent = LEVELS[i].id;
            node.setAttribute('data-testid', `level-node-${LEVELS[i].id}`);
            node.addEventListener('click', () => {
                if (this.completed.includes(LEVELS[i].id) || i === this.currentLevel) {
                    this.loadLevel(i);
                }
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
        this.updateLevelsMap();
        this.updateProgress();
        document.getElementById('missionStatus').textContent = t('statusDone');

        if (this.currentLevel >= LEVELS.length - 1) {
            // All done
            document.getElementById('finalModal').style.display = 'flex';
            return;
        }
        document.getElementById('winFlag').textContent = lvl.flag;
        document.getElementById('winModal').style.display = 'flex';
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
        document.getElementById('restartAllBtn').addEventListener('click', () => {
            document.getElementById('finalModal').style.display = 'none';
            this.completed = [];
            this.loadLevel(0);
        });

        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => window.setLanguage(btn.getAttribute('data-lang')));
        });
    }
};

window.setLanguage = function(lang) {
    if (lang !== 'en' && lang !== 'fr') return;
    window.currentLang = lang;
    document.querySelectorAll('.lang-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-lang') === lang);
    });
    window.applyI18n();
    if (window.GAME && window.GAME.level) {
        window.GAME.renderMission();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.applyI18n();
    window.GAME.boot();
});
