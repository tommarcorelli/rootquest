// fx.js — background matrix rain + boot sequence. Purely cosmetic, no game logic.
(function () {
    'use strict';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Matrix rain ─────────────────────────────────────────────
    const canvas = document.getElementById('matrixCanvas');
    if (canvas && !reduceMotion) {
        const ctx = canvas.getContext('2d');
        const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺ01<>[]{}#$%&*/\\|=+-;:アカサタナ0123456789ABCDEF'.split('');
        const FONT = 16;
        let cols = 0, drops = [], w = 0, h = 0;

        function resize() {
            w = canvas.width = canvas.offsetWidth;
            h = canvas.height = canvas.offsetHeight;
            cols = Math.floor(w / FONT);
            drops = new Array(cols).fill(0).map(() => Math.random() * -50);
        }
        resize();
        window.addEventListener('resize', resize);

        let last = 0;
        function draw(ts) {
            requestAnimationFrame(draw);
            if (ts - last < 55) return;   // ~18 fps
            last = ts;

            ctx.fillStyle = 'rgba(4, 6, 10, 0.10)';
            ctx.fillRect(0, 0, w, h);
            ctx.font = FONT + 'px monospace';

            const root = document.body.classList.contains('is-root');
            const trail = root ? '#8a1030' : '#0a7d7a';
            const head = root ? '#ff2d55' : '#7dffea';

            for (let i = 0; i < drops.length; i++) {
                const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
                const x = i * FONT;
                const y = drops[i] * FONT;
                ctx.fillStyle = Math.random() > 0.92 ? head : trail;
                ctx.fillText(ch, x, y);
                if (y > h && Math.random() > 0.975) drops[i] = 0;
                drops[i] += 1;
            }
        }
        requestAnimationFrame(draw);
    }

    // ── Boot sequence ───────────────────────────────────────────
    function boot() {
        const scr = document.createElement('div');
        scr.id = 'bootScreen';
        scr.innerHTML =
            '<div class="boot-logo">rootQuest</div>' +
            '<div class="boot-bar"><span></span></div>' +
            '<div class="boot-log"></div>';
        document.body.appendChild(scr);

        const log = scr.querySelector('.boot-log');
        const steps = [
            '[ OK ] mounting /dev/pwn',
            '[ OK ] loading exploit modules',
            '[ OK ] enumerating attack surface',
            '[ .. ] bypassing kernel ASLR',
            '[ OK ] establishing neural link',
            'ACCESS GRANTED — welcome, operator.'
        ];
        if (reduceMotion) { log.textContent = steps[steps.length - 1]; }

        let i = 0;
        const timer = setInterval(() => {
            if (reduceMotion) return;
            log.textContent = steps[i] || '';
            i++;
            if (i >= steps.length) clearInterval(timer);
        }, 260);

        setTimeout(() => {
            clearInterval(timer);
            scr.classList.add('hide');
            setTimeout(() => scr.remove(), 700);
            const input = document.getElementById('termInput');
            if (input) input.focus();
        }, reduceMotion ? 500 : 1900);
    }

    if (document.body) boot();
    else document.addEventListener('DOMContentLoaded', boot);
})();
