// Simulated filesystem — per-level clone, mutations tracked in-memory.
window.FS = {
    _tree: {},
    _level: null,

    load(level) {
        this._level = level;
        // Deep clone the level's fs
        this._tree = JSON.parse(JSON.stringify(level.fs));
    },

    exists(path) {
        return this._tree[this.normalize(path)] !== undefined;
    },

    get(path) {
        return this._tree[this.normalize(path)];
    },

    normalize(path) {
        if (!path) return '/';
        // Handle ~ expansion
        if (path === '~') path = '/home/player';
        if (path.startsWith('~/')) path = '/home/player/' + path.slice(2);
        // If relative, resolve against cwd
        if (!path.startsWith('/')) {
            path = (window.SESSION.cwd + '/' + path);
        }
        // Collapse . and ..
        const parts = path.split('/').filter(Boolean);
        const stack = [];
        for (const p of parts) {
            if (p === '.') continue;
            if (p === '..') stack.pop();
            else stack.push(p);
        }
        return '/' + stack.join('/');
    },

    parent(path) {
        const n = this.normalize(path);
        if (n === '/') return '/';
        const idx = n.lastIndexOf('/');
        return idx === 0 ? '/' : n.slice(0, idx);
    },

    basename(path) {
        const n = this.normalize(path);
        return n.split('/').pop() || '/';
    },

    listDir(path) {
        const n = this.normalize(path);
        const node = this._tree[n];
        if (!node) return null;
        if (node.type !== 'dir') return null;
        return node.children.map(name => {
            const childPath = n === '/' ? '/' + name : n + '/' + name;
            return { name, ...this._tree[childPath], path: childPath };
        });
    },

    createFile(path, content, owner) {
        const n = this.normalize(path);
        const parent = this.parent(n);
        const parentNode = this._tree[parent];
        if (!parentNode || parentNode.type !== 'dir') return false;
        const name = this.basename(n);
        this._tree[n] = { type: 'file', owner: owner || window.SESSION.user, mode: '644', content: content };
        if (!parentNode.children.includes(name)) parentNode.children.push(name);
        return true;
    },

    writeFile(path, content) {
        const n = this.normalize(path);
        if (!this._tree[n]) {
            return this.createFile(n, content);
        }
        this._tree[n].content = content;
        return true;
    },

    appendFile(path, content) {
        const n = this.normalize(path);
        if (!this._tree[n]) {
            return this.createFile(n, content);
        }
        this._tree[n].content = (this._tree[n].content || '') + content;
        return true;
    },

    chmod(path, mode) {
        const n = this.normalize(path);
        if (!this._tree[n]) return false;
        this._tree[n].mode = mode;
        if (mode.startsWith('4') || mode.includes('s')) this._tree[n].suid = true;
        return true;
    },

    canRead(path) {
        const n = this.normalize(path);
        const node = this._tree[n];
        if (!node) return false;
        // Root can read everything
        if (window.SESSION.user === 'root') return true;
        // Files with mode 600 or 700 owned by root are unreadable
        if (node.owner === 'root' && (node.mode === '600' || node.mode === '700' || node.mode === '440')) return false;
        if (node.content === 'ACCESS DENIED') return false;
        return true;
    },

    canWrite(path) {
        const n = this.normalize(path);
        const node = this._tree[n];
        if (!node) return false;
        if (window.SESSION.user === 'root') return true;
        if (node.owner === window.SESSION.user) return true;
        // World-writable
        if (node.mode === '777' || node.mode === '666' || node.writable_by_all) return true;
        // /tmp sticky bit allows writes
        const parent = this.parent(n);
        if (parent === '/tmp') return true;
        return false;
    },

    formatMode(node) {
        // Simulate `ls -la` mode string
        const type = node.type === 'dir' ? 'd' : '-';
        const m = node.mode || '644';
        let str = '';
        // Handle 4-digit modes (SUID)
        const digits = m.length === 4 ? m.slice(1) : m;
        const special = m.length === 4 ? parseInt(m[0]) : 0;
        for (let i = 0; i < 3; i++) {
            const d = parseInt(digits[i]);
            str += (d & 4) ? 'r' : '-';
            str += (d & 2) ? 'w' : '-';
            let x = (d & 1) ? 'x' : '-';
            if (i === 0 && (special & 4)) x = (d & 1) ? 's' : 'S';
            if (i === 1 && (special & 2)) x = (d & 1) ? 's' : 'S';
            if (i === 2 && (special & 1)) x = (d & 1) ? 't' : 'T';
            str += x;
        }
        return type + str;
    }
};
