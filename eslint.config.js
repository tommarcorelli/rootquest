// ESLint flat config (ESLint 9+). Keep it light: this is a vanilla-JS,
// no-bundler project where every file attaches globals on `window`, so the
// goal here is catching real bugs (undefined vars, unreachable code, dupe
// keys...) rather than enforcing a style guide.
'use strict';

module.exports = [
    {
        ignores: ['node_modules/**', 'test-results/**', 'playwright-report/**', '_site/**'],
    },
    {
        files: ['js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                localStorage: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                fetch: 'readonly',
                requestAnimationFrame: 'readonly',
                getComputedStyle: 'readonly',
                CanvasRenderingContext2D: 'readonly',
                location: 'readonly',
                history: 'readonly',
                // Every module hangs its API off `window.*` and reads the
                // others back from there (no bundler / import graph), so the
                // cross-file globals below are all "defined elsewhere".
                SESSION: 'readonly',
                FS: 'readonly',
                CMD: 'readonly',
                TERM: 'readonly',
                GAME: 'readonly',
                SFX: 'readonly',
                LEVELS: 'readonly',
                MACHINE_META: 'readonly',
                DIFF_TIERS: 'readonly',
                CHEATS_BY_CAT: 'readonly',
                I18N: 'readonly',
                ACHIEVEMENTS: 'readonly',
                currentLang: 'writable',
                t: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
            'no-undef': 'error',
            'no-redeclare': 'error',
            'no-dupe-keys': 'error',
            'no-dupe-args': 'error',
            'no-unreachable': 'error',
            'no-fallthrough': 'error',
            'no-const-assign': 'error',
            'no-var': 'warn',
            eqeqeq: ['warn', 'smart'],
        },
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'readonly',
                process: 'readonly',
                console: 'readonly',
                __dirname: 'readonly',
                setTimeout: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['warn', { args: 'none' }],
            'no-undef': 'error',
        },
    },
];
