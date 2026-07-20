// proof.js — "Proof of root" shareable card. Draws a 1200×630 (OG-image
// ratio) canvas summarizing a completed box: codename, vuln title, rank,
// time, score, operator callsign, overall progress. Reads live theme colors
// via CSS custom properties, so the card always matches whatever palette is
// currently selected. Pure rendering — no game state is modified here.
window.PROOF = {
    W: 1200,
    H: 630,

    themeColors() {
        const cs = getComputedStyle(document.documentElement);
        const v = (name, fallback) => (cs.getPropertyValue(name) || '').trim() || fallback;
        return {
            bgVoid: v('--bg-void', '#04060a'),
            bg0: v('--bg-0', '#070b12'),
            accent: v('--accent', '#00f0ff'),
            accent2: v('--accent-2', '#ff2bd6'),
            text: v('--text', '#d6ecf3'),
            textDim: v('--text-dim', '#7d96a6'),
            root: v('--root', '#ff2d55')
        };
    },

    // Waits for the self-hosted webfonts to be ready (they may not have
    // painted yet if this is the very first canvas draw of the session),
    // falling back gracefully to system fonts otherwise.
    async fontsReady() {
        try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { /* ignore */ }
    },

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    },

    // data = { codename, title, rank, time, best, hints, cmds, score,
    //          hardened, opRank, owned, total, lang, date }
    async render(canvas, data) {
        await this.fontsReady();
        const ctx = canvas.getContext('2d');
        const c = this.themeColors();
        const W = this.W, H = this.H;
        canvas.width = W; canvas.height = H;

        // Background
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, c.bgVoid);
        grad.addColorStop(1, c.bg0);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Faint grid, cheap parallel-line pattern (matches the app's fx-grid feel)
        ctx.strokeStyle = c.accent;
        ctx.globalAlpha = 0.06;
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        ctx.globalAlpha = 1;

        // Outer frame, corner-cut like the app's HUD panels
        ctx.strokeStyle = c.accent;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
        const m = 28, cut = 24;
        ctx.beginPath();
        ctx.moveTo(m + cut, m); ctx.lineTo(W - m, m); ctx.lineTo(W - m, H - m - cut);
        ctx.lineTo(W - m - cut, H - m); ctx.lineTo(m, H - m); ctx.lineTo(m, m + cut);
        ctx.closePath(); ctx.stroke();
        ctx.globalAlpha = 1;

        // Brand
        ctx.fillStyle = c.accent;
        ctx.font = '700 22px "Orbitron", "Space Grotesk", sans-serif';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('rootQuest', 60, 78);
        ctx.fillStyle = c.textDim;
        ctx.font = '400 13px "JetBrains Mono", monospace';
        ctx.fillText(data.lang === 'fr' ? '// PREUVE DE ROOT' : '// PROOF OF ROOT', 60, 98);

        // Root badge, top right
        ctx.textAlign = 'right';
        ctx.fillStyle = c.root;
        ctx.font = '700 16px "JetBrains Mono", monospace';
        ctx.fillText('● root', W - 60, 78);
        ctx.textAlign = 'left';

        // Codename + title
        ctx.fillStyle = c.text;
        ctx.font = '700 46px "Orbitron", "Space Grotesk", sans-serif';
        ctx.fillText(data.codename, 60, 190);
        ctx.fillStyle = c.textDim;
        ctx.font = '400 22px "Space Grotesk", sans-serif';
        this.wrapText(ctx, data.title, 60, 226, W - 120, 28, 2);

        // Big rank badge, right side
        const rankColors = { S: '#ffd54b', A: c.accent, B: c.accent2, C: c.textDim };
        ctx.textAlign = 'center';
        ctx.fillStyle = rankColors[data.rank] || c.accent;
        ctx.font = '700 120px "Orbitron", "Space Grotesk", sans-serif';
        ctx.fillText(data.rank, W - 160, 240);
        ctx.font = '400 15px "JetBrains Mono", monospace';
        ctx.fillStyle = c.textDim;
        ctx.fillText(data.lang === 'fr' ? 'RANG' : 'RANK', W - 160, 268);
        ctx.textAlign = 'left';

        // Stat row
        const stats = [
            [data.lang === 'fr' ? 'Temps' : 'Time', data.time],
            [data.lang === 'fr' ? 'Indices' : 'Hints', data.hints],
            [data.lang === 'fr' ? 'Commandes' : 'Commands', String(data.cmds)],
            [data.lang === 'fr' ? 'Score' : 'Score', String(data.score)]
        ];
        const statY = 360, statW = (W - 120) / stats.length;
        stats.forEach((s, i) => {
            const x = 60 + i * statW;
            ctx.fillStyle = c.accent;
            ctx.font = '700 34px "JetBrains Mono", monospace';
            ctx.fillText(s[1], x, statY);
            ctx.fillStyle = c.textDim;
            ctx.font = '400 13px "JetBrains Mono", monospace';
            ctx.fillText(s[0].toUpperCase(), x, statY + 24);
        });

        // Divider
        ctx.strokeStyle = c.accent;
        ctx.globalAlpha = 0.25;
        ctx.beginPath(); ctx.moveTo(60, statY + 50); ctx.lineTo(W - 60, statY + 50); ctx.stroke();
        ctx.globalAlpha = 1;

        // Footer: operator callsign + overall progress + date
        ctx.fillStyle = c.text;
        ctx.font = '700 16px "JetBrains Mono", monospace';
        ctx.fillText(`${data.opRank}`, 60, statY + 90);
        ctx.fillStyle = c.textDim;
        ctx.font = '400 14px "JetBrains Mono", monospace';
        ctx.fillText(
            `${data.owned}/${data.total} ${data.lang === 'fr' ? 'possédées' : 'owned'}` +
            (data.hardened ? `  ·  ${data.hardened} 🛡` : '') +
            (data.best ? `  ·  ${data.lang === 'fr' ? 'record' : 'best'} ${data.best}` : ''),
            60, statY + 112
        );
        ctx.textAlign = 'right';
        ctx.fillText(data.date, W - 60, statY + 112);
        ctx.textAlign = 'left';
    },

    wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
        const words = String(text).split(' ');
        let line = '', lines = 0, cy = y;
        for (let n = 0; n < words.length; n++) {
            const test = line + words[n] + ' ';
            if (ctx.measureText(test).width > maxWidth && line) {
                ctx.fillText(line.trim(), x, cy);
                line = words[n] + ' ';
                cy += lineHeight;
                lines++;
                if (lines >= maxLines - 1) {
                    const rest = words.slice(n + 1).join(' ');
                    ctx.fillText((line + rest).trim(), x, cy);
                    return;
                }
            } else {
                line = test;
            }
        }
        ctx.fillText(line.trim(), x, cy);
    },

    download(canvas, filename) {
        const a = document.createElement('a');
        a.download = filename;
        a.href = canvas.toDataURL('image/png');
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
};
