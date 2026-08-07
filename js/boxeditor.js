// ── Box Editor ────────────────────────────────────────────────────────────
// Graphical fs-tree builder for the "Custom box" panel's third tab. Fills
// the gap the visual builder's fixed templates don't cover: a click-driven
// tree (add/edit/delete file & dir nodes) plus a win-condition picker that
// reuses the same generic engine mechanics as js/boxbuilder.js — this is
// deliberately a superset of that tool, not a replacement for it. Like
// boxbuilder.js, it only ever writes into the shared #customJsonInput
// textarea; GAME_CUSTOM.import() remains the single source of truth for
// what a valid box looks like.
window.BOXEDITOR = {

    state: null, // { fs, selectedPath }

    freshState(flag) {
        return { fs: window.BOXBUILDER.baseFS(flag || 'flag{custom_box}'), selectedPath: '/' };
    },

    esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },

    childPath(dirPath, name) { return dirPath === '/' ? '/' + name : dirPath + '/' + name; },

    // Recursively deletes a node and everything under it, and unlinks it
    // from its parent's `children`. Refuses to touch '/'.
    removeNode(fs, targetPath) {
        if (targetPath === '/') return false;
        const parentPath = targetPath.slice(0, targetPath.lastIndexOf('/')) || '/';
        const name = targetPath.slice(targetPath.lastIndexOf('/') + 1);
        if (fs[parentPath] && fs[parentPath].children) {
            fs[parentPath].children = fs[parentPath].children.filter(c => c !== name);
        }
        Object.keys(fs).filter(p => p === targetPath || p.startsWith(targetPath + '/')).forEach(p => delete fs[p]);
        return true;
    },

    sortedChildren(fs, dirPath) {
        const node = fs[dirPath];
        if (!node || !node.children) return [];
        return [...node.children].sort((a, b) => {
            const an = fs[this.childPath(dirPath, a)], bn = fs[this.childPath(dirPath, b)];
            const aDir = an && an.type === 'dir', bDir = bn && bn.type === 'dir';
            if (aDir !== bDir) return aDir ? -1 : 1;
            return a.localeCompare(b);
        });
    },

    // ── Rendering ─────────────────────────────────────────────────────────
    renderTree() {
        const el = document.getElementById('cgTree');
        if (!el || !this.state) return;
        const fs = this.state.fs;
        const rows = [];
        const walk = (path, depth) => {
            const node = fs[path];
            if (!node) return;
            const isDir = node.type === 'dir';
            const name = path === '/' ? '/' : path.slice(path.lastIndexOf('/') + 1);
            const selected = path === this.state.selectedPath ? ' is-selected' : '';
            const badges = `${this.esc(node.owner || 'root')}:${this.esc(node.mode || '')}`
                + (node.suid ? ' suid' : '') + (node.writable_by_all ? ' www' : '') + (node.exploit ? ' ⚡' : '');
            rows.push(
                `<div class="cg-node-row${selected}" data-path="${this.esc(path)}" style="padding-left:${depth * 14 + 8}px">`
                + `<span class="cg-node-icon">${isDir ? '📁' : '📄'}</span>`
                + `<span class="cg-node-name">${this.esc(name)}</span>`
                + `<span class="cg-node-badges">${badges}</span>`
                + `</div>`
            );
            if (isDir) this.sortedChildren(fs, path).forEach(c => walk(this.childPath(path, c), depth + 1));
        };
        walk('/', 0);
        el.innerHTML = rows.join('');
    },

    renderNodeEditor() {
        const el = document.getElementById('cgNodeEditor');
        if (!el || !this.state) return;
        const path = this.state.selectedPath;
        const node = this.state.fs[path];
        const t = window.t || ((k) => k);
        if (!node) { el.innerHTML = `<p class="custom-json-hint">${t('cgNodeHint')}</p>`; return; }
        const isRoot = path === '/';
        const isDir = node.type === 'dir';
        let html = `<div class="cg-node-path">${this.esc(path)}</div>`;
        html += `<div class="custom-build-row">
            <div class="custom-build-field"><label>${t('cgOwnerLabel')}</label><input id="cgN_owner" data-testid="cgn-owner" value="${this.esc(node.owner || 'root')}"></div>
            <div class="custom-build-field"><label>${t('cgModeLabel')}</label><input id="cgN_mode" data-testid="cgn-mode" value="${this.esc(node.mode || (isDir ? '755' : '644'))}"></div>
        </div>`;
        if (!isDir) {
            html += `<div class="custom-build-field"><label>${t('cgContentLabel')}</label><textarea id="cgN_content" data-testid="cgn-content" rows="3">${this.esc(node.content || '')}</textarea></div>`;
            html += `<div class="custom-build-row">
                <label class="cg-checkbox"><input type="checkbox" id="cgN_suid" data-testid="cgn-suid" ${node.suid ? 'checked' : ''}> ${t('cgSuidLabel')}</label>
                <label class="cg-checkbox"><input type="checkbox" id="cgN_writable" data-testid="cgn-writable" ${node.writable_by_all ? 'checked' : ''}> ${t('cgWritableLabel')}</label>
            </div>`;
            html += `<div class="custom-build-row">
                <div class="custom-build-field"><label>${t('cgCallsLabel')}</label><input id="cgN_calls" data-testid="cgn-calls" value="${this.esc(node.calls_unqualified || '')}" placeholder="ps"></div>
                <div class="custom-build-field"><label>${t('cgExploitLabel')}</label><input id="cgN_exploit" data-testid="cgn-exploit" value="${this.esc(node.exploit || '')}" placeholder="custom_suid_exploit"></div>
            </div>`;
        }
        html += `<div class="home-custom-actions">
            <button class="btn-primary" id="cgSaveNodeBtn" type="button" data-testid="cg-save-node-btn">${t('cgSaveNode')}</button>
            ${isDir ? `<button class="btn-ghost" id="cgAddFileBtn" type="button" data-testid="cg-add-file-btn">+ ${t('cgAddFile')}</button><button class="btn-ghost" id="cgAddDirBtn" type="button" data-testid="cg-add-dir-btn">+ ${t('cgAddDir')}</button>` : ''}
            ${!isRoot ? `<button class="btn-ghost" id="cgDeleteNodeBtn" type="button" data-testid="cg-delete-node-btn">${t('cgDeleteNode')}</button>` : ''}
        </div>`;
        el.innerHTML = html;

        const save = document.getElementById('cgSaveNodeBtn');
        if (save) save.addEventListener('click', () => this.saveNode(path));
        const addFile = document.getElementById('cgAddFileBtn');
        if (addFile) addFile.addEventListener('click', () => this.addChild(path, false));
        const addDir = document.getElementById('cgAddDirBtn');
        if (addDir) addDir.addEventListener('click', () => this.addChild(path, true));
        const del = document.getElementById('cgDeleteNodeBtn');
        if (del) del.addEventListener('click', () => this.deleteSelected(path));
    },

    renderWinFields() {
        const typeSel = document.getElementById('cgWinType');
        const el = document.getElementById('cgWinFields');
        if (!typeSel || !el) return;
        const type = typeSel.value;
        const t = window.t || ((k) => k);
        let html = '';
        if (type === 'cron_hijack') {
            html = `<div class="custom-build-field"><label>${t('cgWinPathLabel')}</label><input id="cgWinPath" data-testid="cg-win-path" placeholder="/opt/task.sh"></div>`;
        } else if (type === 'path_hijack') {
            html = `<div class="custom-build-field"><label>${t('cgWinPathLabel')}</label><input id="cgWinPath" data-testid="cg-win-path" placeholder="/usr/local/bin/status-helper"></div>`
                + `<div class="custom-build-field"><label>${t('cbHijackCmdLabel')}</label><input id="cgWinHijackCmd" data-testid="cg-win-hijackcmd" placeholder="ps"></div>`;
        } else if (type === 'sudo_shell') {
            const bins = ['find', 'awk', 'env', 'python3', 'perl', 'node', 'nice', 'less', 'vim'];
            html = `<div class="custom-build-field"><label>${t('cbSudoBinLabel')}</label><select id="cgWinSudoBin" data-testid="cg-win-sudobin">`
                + bins.map(b => `<option value="${b}">${b}</option>`).join('') + `</select></div>`;
        } else if (type === 'custom') {
            html = `<div class="custom-build-field"><label>${t('cgWinCustomTypeLabel')}</label><input id="cgWinCustomType" data-testid="cg-win-customtype" placeholder="my_custom_win"></div>`;
        } else {
            html = `<p class="custom-json-hint">${t('cgWinAutoHint')}</p>`;
        }
        el.innerHTML = html;
    },

    // ── Mutations ─────────────────────────────────────────────────────────
    saveNode(path) {
        const node = this.state.fs[path];
        if (!node) return;
        const owner = document.getElementById('cgN_owner');
        const mode = document.getElementById('cgN_mode');
        if (owner) node.owner = owner.value.trim() || 'root';
        if (mode) node.mode = mode.value.trim() || (node.type === 'dir' ? '755' : '644');
        if (node.type !== 'dir') {
            const content = document.getElementById('cgN_content');
            const suid = document.getElementById('cgN_suid');
            const writable = document.getElementById('cgN_writable');
            const calls = document.getElementById('cgN_calls');
            const exploit = document.getElementById('cgN_exploit');
            if (content) node.content = content.value;
            if (suid) { if (suid.checked) node.suid = true; else delete node.suid; }
            if (writable) { if (writable.checked) node.writable_by_all = true; else delete node.writable_by_all; }
            if (calls && calls.value.trim()) node.calls_unqualified = calls.value.trim(); else delete node.calls_unqualified;
            if (exploit && exploit.value.trim()) node.exploit = exploit.value.trim(); else delete node.exploit;
        }
        this.renderTree();
        this.renderNodeEditor();
    },

    addChild(parentPath, isDir) {
        const t = window.t || ((k) => k);
        const name = (window.prompt(t(isDir ? 'cgPromptDirName' : 'cgPromptFileName')) || '').trim();
        if (!name) return;
        if (name.includes('/')) { window.alert(t('cgErrBadName')); return; }
        const path = this.childPath(parentPath, name);
        if (this.state.fs[path]) { window.alert(t('cgErrDupName')); return; }
        this.state.fs[path] = isDir
            ? { type: 'dir', owner: 'root', mode: '755', children: [] }
            : { type: 'file', owner: 'root', mode: '644', content: '' };
        this.state.fs[parentPath].children.push(name);
        this.state.selectedPath = path;
        this.renderTree();
        this.renderNodeEditor();
    },

    deleteSelected(path) {
        const t = window.t || ((k) => k);
        if (!window.confirm(t('cgConfirmDelete'))) return;
        const parentPath = path.slice(0, path.lastIndexOf('/')) || '/';
        this.removeNode(this.state.fs, path);
        this.state.selectedPath = parentPath;
        this.renderTree();
        this.renderNodeEditor();
    },

    loadStart() {
        const kind = document.getElementById('cgStart').value;
        const flagInput = document.getElementById('cgFlag');
        const flag = (flagInput && flagInput.value.trim()) || 'flag{custom_box}';
        const winTypeSel = document.getElementById('cgWinType');
        if (kind === 'empty') {
            this.state = this.freshState(flag);
            if (winTypeSel) winTypeSel.value = 'auto';
        } else {
            const defaultPath = {
                suid_misuse: '/usr/local/bin/backup-tool', cron_hijack: '/opt/task.sh',
                path_hijack: '/usr/local/bin/status-helper', passwd_writable: null, sudo_gtfobin: null
            }[kind];
            const part = window.BOXBUILDER.templates[kind](defaultPath, flag, 'find', 'ps');
            this.state = { fs: part.fs, selectedPath: '/' };
            const winTypeMap = { suid_misuse: 'auto', cron_hijack: 'cron_hijack', passwd_writable: 'passwd_write', sudo_gtfobin: 'sudo_shell', path_hijack: 'path_hijack' };
            if (winTypeSel && winTypeMap[kind]) winTypeSel.value = winTypeMap[kind];
        }
        this.renderTree();
        this.renderNodeEditor();
        this.renderWinFields();
        if (kind === 'cron_hijack') {
            const winPath = document.getElementById('cgWinPath');
            if (winPath) winPath.value = '/opt/task.sh';
        } else if (kind === 'path_hijack') {
            const winPath = document.getElementById('cgWinPath');
            const hc = document.getElementById('cgWinHijackCmd');
            if (winPath) winPath.value = '/usr/local/bin/status-helper';
            if (hc) hc.value = 'ps';
        }
    },

    // ── JSON assembly ────────────────────────────────────────────────────
    // Pure function: takes an explicit fs + params object (no DOM reads),
    // so it can be exercised directly from tests/harness.js. generate()
    // below is the thin DOM-reading wrapper the "Générer" button calls.
    buildBox(fs, params) {
        const codename = (params.codename || 'custom-02').trim();
        const flag = (params.flag || `flag{${codename.replace(/[^a-z0-9]+/gi, '_')}}`).trim();
        if (fs['/root/flag.txt']) fs['/root/flag.txt'].content = flag + '\n';

        const winType = params.winType || 'auto';
        let wins = [];
        let sudoers;
        if (winType === 'auto') {
            const exploitTypes = [...new Set(Object.values(fs).filter(n => n.exploit).map(n => n.exploit))];
            wins = exploitTypes.length ? exploitTypes.map(ty => ({ type: ty })) : [{ type: 'custom_win' }];
        } else if (winType === 'cron_hijack') {
            wins = [{ type: 'cron_hijack', path: (params.winPath || '/opt/task.sh').trim() }];
        } else if (winType === 'path_hijack') {
            wins = [{ type: 'path_hijack', target: (params.winPath || '').trim(), hijack_cmd: (params.winHijackCmd || 'ps').trim() }];
        } else if (winType === 'passwd_write') {
            wins = [{ type: 'passwd_write' }];
        } else if (winType === 'sudo_shell') {
            const bin = params.winSudoBin || 'find';
            wins = [{ type: 'sudo_shell' }];
            sudoers = { player: [{ cmd: '/usr/bin/' + bin, nopasswd: true, runas: 'root' }] };
        } else if (winType === 'custom') {
            wins = [{ type: (params.winCustomType || 'custom_win').trim() || 'custom_win' }];
        }

        const box = {
            codename,
            title: (params.title || codename).trim(),
            brief: (params.brief || '').trim() || 'Box personnalisée construite avec l\'éditeur graphique.',
            user: 'player', host: codename, cwd: '/home/player',
            objectives: ['Explorer le système (ls, cat, find)', 'Identifier la faille que tu as construite', 'Obtenir un shell root'],
            hints: ['Regarde d\'abord autour de toi : ls -la, puis cat les fichiers qui semblent intéressants.', 'find / -perm -4000 2>/dev/null repère les binaires SUID ; cat /etc/crontab liste les jobs planifiés.', 'Tu connais déjà la faille — tu viens de la construire toi-même !'],
            flag, fs, wins
        };
        if (sudoers) box.sudoers = sudoers;
        return box;
    },

    generate() {
        const params = {
            codename: (document.getElementById('cgCodename') || {}).value,
            flag: (document.getElementById('cgFlag') || {}).value,
            title: (document.getElementById('cgTitle') || {}).value,
            brief: (document.getElementById('cgBrief') || {}).value,
            winType: (document.getElementById('cgWinType') || {}).value,
            winPath: (document.getElementById('cgWinPath') || {}).value,
            winHijackCmd: (document.getElementById('cgWinHijackCmd') || {}).value,
            winSudoBin: (document.getElementById('cgWinSudoBin') || {}).value,
            winCustomType: (document.getElementById('cgWinCustomType') || {}).value
        };
        return JSON.stringify(this.buildBox(this.state.fs, params), null, 2);
    },

    // ── DOM wiring ────────────────────────────────────────────────────────
    init() {
        const graphBtn = document.getElementById('customModeGraphBtn');
        const tree = document.getElementById('cgTree');
        const loadBtn = document.getElementById('cgLoadStartBtn');
        const winType = document.getElementById('cgWinType');
        const genBtn = document.getElementById('cgGenerateBtn');
        if (!graphBtn || !tree || !loadBtn || !winType || !genBtn) return;

        this.state = this.freshState('flag{custom_box}');

        graphBtn.addEventListener('click', () => {
            this.renderTree();
            this.renderNodeEditor();
            this.renderWinFields();
        });
        tree.addEventListener('click', (e) => {
            const row = e.target.closest('[data-path]');
            if (!row) return;
            this.state.selectedPath = row.getAttribute('data-path');
            this.renderTree();
            this.renderNodeEditor();
        });
        loadBtn.addEventListener('click', () => this.loadStart());
        winType.addEventListener('change', () => this.renderWinFields());
        genBtn.addEventListener('click', () => {
            const json = this.generate();
            const jsonInput = document.getElementById('customJsonInput');
            jsonInput.value = json;
            if (window.BOXBUILDER && window.BOXBUILDER.showPasteTab) window.BOXBUILDER.showPasteTab();
            jsonInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        this.renderTree();
        this.renderNodeEditor();
        this.renderWinFields();
    }
};
