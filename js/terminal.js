// Terminal UI — history, rendering, prompt.
window.TERM = {
    history: [],
    historyIdx: -1,
    inputEl: null,
    outputEl: null,
    promptEl: null,
    searching: false,   // Ctrl+R reverse-search mode
    searchQuery: '',
    searchPos: -1,      // index into history currently shown

    init() {
        this.inputEl = document.getElementById('termInput');
        this.outputEl = document.getElementById('termOutput');
        this.promptEl = document.getElementById('prompt');

        this.inputEl.addEventListener('keydown', (e) => this.onKey(e));
        document.getElementById('terminal').addEventListener('click', () => this.inputEl.focus());

        this.inputEl.focus();
    },

    onKey(e) {
        if (window.SFX) {
            if (e.key === 'Enter') window.SFX.enter();
            else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) window.SFX.key();
        }
        if (e.key === 'r' && e.ctrlKey) {
            e.preventDefault();
            this.advanceSearch();
            return;
        }
        if (this.searching) {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.exitSearch(false);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                this.exitSearch(true);
                const raw = this.inputEl.value;
                this.submit(raw);
                this.inputEl.value = '';
                this.historyIdx = -1;
                return;
            }
            if (e.key === 'Backspace') {
                e.preventDefault();
                this.searchQuery = this.searchQuery.slice(0, -1);
                this.searchPos = this.history.length;
                this.runSearch();
                return;
            }
            if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                this.searchQuery += e.key;
                this.searchPos = this.history.length;
                this.runSearch();
                return;
            }
            // Any other key (arrows, tab, etc.) falls through and ends the search.
            this.exitSearch(true);
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            const raw = this.inputEl.value;
            this.submit(raw);
            this.inputEl.value = '';
            this.historyIdx = -1;
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (this.history.length === 0) return;
            if (this.historyIdx === -1) this.historyIdx = this.history.length - 1;
            else this.historyIdx = Math.max(0, this.historyIdx - 1);
            this.inputEl.value = this.history[this.historyIdx];
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (this.historyIdx === -1) return;
            this.historyIdx++;
            if (this.historyIdx >= this.history.length) {
                this.historyIdx = -1;
                this.inputEl.value = '';
            } else {
                this.inputEl.value = this.history[this.historyIdx];
            }
        } else if (e.key === 'l' && e.ctrlKey) {
            e.preventDefault();
            this.outputEl.innerHTML = '';
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this.tabComplete();
        }
    },

    // Ctrl+R reverse-incremental-search, bash-style: first press starts a
    // search session seeded by whatever was already typed; each further
    // press walks one match further back in history. History now persists
    // across machines (saved in GAME's localStorage), so this genuinely
    // helps recall payloads from earlier boxes.
    advanceSearch() {
        if (!this.searching) {
            this.searching = true;
            this.searchQuery = this.inputEl.value;
            this.searchPos = this.history.length;
        }
        this.runSearch();
    },

    runSearch() {
        const q = this.searchQuery.toLowerCase();
        if (q) {
            for (let i = this.searchPos - 1; i >= 0; i--) {
                if (this.history[i].toLowerCase().includes(q)) {
                    this.searchPos = i;
                    this.inputEl.value = this.history[i];
                    this.renderSearchPrompt(this.history[i], false);
                    return;
                }
            }
            this.renderSearchPrompt(this.inputEl.value, true);
        } else {
            this.searchPos = this.history.length;
            this.renderSearchPrompt('', false);
        }
    },

    renderSearchPrompt(match, failed) {
        const label = failed ? 'failed reverse-i-search' : 'reverse-i-search';
        this.promptEl.innerHTML = `(${label})\`${this.escapeHtml(this.searchQuery)}': `;
    },

    exitSearch(keepMatch) {
        this.searching = false;
        if (!keepMatch) this.inputEl.value = '';
        this.searchQuery = '';
        this.searchPos = -1;
        this.updatePrompt();
    },

    commonPrefix(arr) {
        if (!arr.length) return '';
        let p = arr[0];
        for (const s of arr) { while (!s.startsWith(p)) p = p.slice(0, -1); }
        return p;
    },

    tabComplete() {
        const val = this.inputEl.value;
        // First token, still being typed → complete against command names.
        if (val && !val.includes(' ')) {
            const names = Object.keys(window.CMD.handlers).filter(n => /^[a-z0-9]+$/.test(n));
            const matches = names.filter(n => n.startsWith(val)).sort();
            if (matches.length === 1) { this.inputEl.value = matches[0] + ' '; return; }
            if (matches.length > 1) {
                const common = this.commonPrefix(matches);
                if (common.length > val.length) this.inputEl.value = common;
                this.print([{ text: matches.join('  '), cls: 'dim' }]);
                this.scrollToBottom();
            }
            return;
        }
        const tokens = val.split(' ');
        const last = tokens[tokens.length - 1];
        if (!last) return;
        // Try to complete path
        const parent = last.includes('/') ? last.slice(0, last.lastIndexOf('/') + 1) : '';
        const stub = last.includes('/') ? last.slice(last.lastIndexOf('/') + 1) : last;
        const dir = parent ? FS.normalize(parent) : SESSION.cwd;
        const list = FS.listDir(dir);
        if (!list) return;
        const matches = list.map(l => l.name).filter(n => n.startsWith(stub));
        if (matches.length === 1) {
            const completed = parent + matches[0];
            tokens[tokens.length - 1] = completed;
            this.inputEl.value = tokens.join(' ');
        } else if (matches.length > 1) {
            this.print([{ text: matches.join('  '), cls: 'dim' }]);
            this.renderPromptEcho(val);
        }
    },

    submit(raw) {
        // Echo the prompt + input
        this.renderPromptEcho(raw);
        if (raw.trim()) this.history.push(raw);
        const lines = window.CMD.execute(raw);
        this.print(lines);
        if (window.SFX && lines.some(l => l.cls === 'err')) window.SFX.error();
        this.scrollToBottom();
        if (window.GAME && window.GAME.saveProgress) window.GAME.saveProgress();
    },

    renderPromptEcho(cmd) {
        const isRoot = SESSION.isRoot;
        const promptText = this.getPromptText(true);
        const div = document.createElement('div');
        div.className = 'line';
        div.innerHTML = `<span class="prompt-line" style="color:${isRoot ? 'var(--root)' : 'var(--accent)'}">${promptText}</span><span class="cmd-echo">${this.escapeHtml(cmd)}</span>`;
        this.outputEl.appendChild(div);
    },

    print(lines) {
        for (const line of lines) {
            const div = document.createElement('div');
            div.className = 'line ' + (line.cls || '');
            div.textContent = line.text;
            this.outputEl.appendChild(div);
        }
    },

    printHtml(html) {
        const div = document.createElement('div');
        div.className = 'line';
        div.innerHTML = html;
        this.outputEl.appendChild(div);
    },

    printLines(text, cls = '') {
        if (Array.isArray(text)) {
            for (const t of text) this.print([{ text: t, cls }]);
        } else {
            this.print([{ text, cls }]);
        }
    },

    getPromptText(forEcho) {
        const isRoot = SESSION.isRoot;
        const user = isRoot ? 'root' : SESSION.user;
        const host = SESSION.host;
        let cwdDisplay = SESSION.cwd;
        if (cwdDisplay === '/home/player') cwdDisplay = '~';
        else if (cwdDisplay.startsWith('/home/player/')) cwdDisplay = '~' + cwdDisplay.slice('/home/player'.length);
        const symbol = isRoot ? '#' : '$';
        // Kali/Parrot style two-line prompt
        return `┌──(${user}㉿${host})-[${cwdDisplay}]<br>└─${symbol}&nbsp;`;
    },

    updatePrompt() {
        this.promptEl.innerHTML = this.getPromptText();
    },

    scrollToBottom() {
        const term = document.getElementById('terminal');
        term.scrollTop = term.scrollHeight;
    },

    escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
};

window.updatePrompt = () => window.TERM.updatePrompt();
