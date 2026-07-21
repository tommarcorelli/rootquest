// nano.js — faux éditeur `nano`, plein écran, branché sur le FS simulé.
// Contrairement à vim/awk (qui restent de purs jeux de mots-clés pour leurs
// échappées GTFOBins), nano ouvre un vrai buffer éditable : plus proche de
// l'usage réel sur les box cron/wildcard, où on modifie un script à la main.
window.NANO = {
    path: null,
    savedContent: '',
    confirmingExit: false,

    overlay: null,
    textarea: null,
    statusEl: null,
    fileEl: null,
    modifiedEl: null,

    ensureEls() {
        if (this.overlay) return;
        this.overlay = document.getElementById('nanoOverlay');
        this.textarea = document.getElementById('nanoTextarea');
        this.statusEl = document.getElementById('nanoStatus');
        this.fileEl = document.getElementById('nanoFileName');
        this.modifiedEl = document.getElementById('nanoModified');
        if (!this.overlay || !this.textarea) return;

        this.textarea.addEventListener('keydown', (e) => this.onKey(e));
        this.textarea.addEventListener('input', () => this.onInput());
    },

    open(path, content) {
        this.ensureEls();
        if (!this.overlay || !this.textarea) return;
        this.path = path;
        this.savedContent = content || '';
        this.confirmingExit = false;
        this.textarea.value = this.savedContent;
        this.fileEl.textContent = path;
        this.setModified(false);
        this.setStatus('');
        this.overlay.style.display = 'flex';
        if (window.TERM && window.TERM.inputEl) window.TERM.inputEl.blur();
        requestAnimationFrame(() => { this.textarea.focus(); this.textarea.setSelectionRange(0, 0); });
    },

    close() {
        if (this.overlay) this.overlay.style.display = 'none';
        this.confirmingExit = false;
        this.setStatus('');
        if (window.TERM && window.TERM.inputEl) window.TERM.inputEl.focus();
    },

    isDirty() {
        return this.textarea.value !== this.savedContent;
    },

    setModified(dirty) {
        if (this.modifiedEl) this.modifiedEl.textContent = dirty ? t('nanoModified') : '';
    },

    setStatus(text) {
        if (this.statusEl) this.statusEl.textContent = text;
    },

    onInput() {
        if (this.confirmingExit) return; // buffer shouldn't change mid-prompt
        this.setModified(this.isDirty());
        if (this.statusEl && this.statusEl.textContent) this.setStatus('');
    },

    // Actual write path: mirrors the permission rules `>` redirects use, so a
    // read-only or root-owned target genuinely refuses the write here too.
    save() {
        const CMD = window.CMD, FS = window.FS;
        const content = this.textarea.value;
        if (!CMD.canRedirectTarget(this.path)) {
            this.setStatus(t('nanoDenied', this.path));
            if (window.SFX) window.SFX.error();
            return false;
        }
        if (!FS.get(this.path)) {
            FS.createFile(this.path, content, CMD.creationOwner(this.path));
        } else {
            FS.writeFile(this.path, content);
        }
        this.savedContent = content;
        this.setModified(false);
        const lines = content.length ? content.split('\n').length : 1;
        this.setStatus(t('nanoWrote', lines, this.path));
        return true;
    },

    attemptExit() {
        if (!this.isDirty()) { this.close(); return; }
        this.confirmingExit = true;
        this.setStatus(t('nanoSaveModified'));
    },

    onKey(e) {
        if (this.confirmingExit) {
            e.preventDefault();
            const k = e.key.toLowerCase();
            if (k === 'y') { if (this.save()) this.close(); else this.confirmingExit = false; }
            else if (k === 'n') { this.close(); }
            else if (k === 'c' && e.ctrlKey) { this.confirmingExit = false; this.setStatus(''); }
            else if (e.key === 'Escape') { this.confirmingExit = false; this.setStatus(''); }
            return;
        }
        if (e.ctrlKey && e.key.toLowerCase() === 'o') { e.preventDefault(); this.save(); return; }
        if (e.ctrlKey && e.key.toLowerCase() === 'x') { e.preventDefault(); this.attemptExit(); return; }
        // Everything else (^K cut, ^U paste, etc.) is left to the browser's
        // native textarea editing — this is a training sandbox, not a full
        // nano reimplementation.
    }
};
