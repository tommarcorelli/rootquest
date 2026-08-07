// ── Box Builder ──────────────────────────────────────────────────────────
// Visual assistant for the "Custom box" panel: fills out a short form and
// generates a full, valid, ready-to-import box JSON — no hand-written fs
// tree required for the common vulnerability shapes. Writes into the same
// #customJsonInput textarea the paste-JSON flow already uses, so the
// existing GAME_CUSTOM.import()/validate() logic is the only place that
// ever decides whether a box is well-formed. Purely additive: nothing here
// runs unless the player opens the "🧰 Assistant visuel" tab.
window.BOXBUILDER = {

    ELF_BIN(overrides = {}) { return { type: 'file', owner: 'root', mode: '755', content: 'ELF binary', ...overrides }; },
    SUID_BIN(overrides = {}) { return { type: 'file', owner: 'root', mode: '4755', suid: true, content: 'ELF binary', ...overrides }; },

    // Minimal base filesystem every generated box starts from — a home dir
    // for `player`, a passwd file, the flag, and the handful of coreutils
    // every level exposes (ls/cat/sh/bash), following the same shape used
    // throughout js/levels.js.
    baseFS(flag) {
        return {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: flag + '\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash'] },
            '/usr/bin/ls': this.ELF_BIN(),
            '/usr/bin/cat': this.ELF_BIN(),
            '/usr/bin/sh': this.ELF_BIN(),
            '/usr/bin/bash': this.ELF_BIN(),
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        };
    },

    // Ensures every ancestor directory of `fullPath` exists in `fs` (creating
    // plain root:root 755 dirs as needed) and registers each segment in its
    // parent's `children`, then writes `fileNode` at `fullPath`. Lets a
    // player type any path (e.g. /opt/tasks/monitor.sh) without the caller
    // having to hand-build the directory chain.
    placeFile(fs, fullPath, fileNode) {
        const parts = fullPath.split('/').filter(Boolean);
        let cur = '';
        for (let i = 0; i < parts.length - 1; i++) {
            const parent = cur || '/';
            cur = cur + '/' + parts[i];
            if (!fs[parent]) fs[parent] = { type: 'dir', owner: 'root', mode: '755', children: [] };
            if (!fs[parent].children.includes(parts[i])) fs[parent].children.push(parts[i]);
            if (!fs[cur]) fs[cur] = { type: 'dir', owner: 'root', mode: '755', children: [] };
        }
        const parentPath = cur || '/';
        const fname = parts[parts.length - 1];
        if (!fs[parentPath]) fs[parentPath] = { type: 'dir', owner: 'root', mode: '755', children: [] };
        if (!fs[parentPath].children.includes(fname)) fs[parentPath].children.push(fname);
        fs[fullPath] = fileNode;
    },

    SUDO_PAYLOADS: {
        find: 'sudo find . -exec /bin/sh \\;',
        awk: 'sudo awk \'BEGIN{system("/bin/sh")}\'',
        env: 'sudo env /bin/sh',
        python3: 'sudo python3 -c \'import os; os.system("/bin/sh")\'',
        perl: 'sudo perl -e \'exec "/bin/sh";\'',
        node: 'sudo node -e \'require("child_process").spawn("/bin/sh", {stdio: [0, 1, 2]})\'',
        nice: 'sudo nice /bin/sh',
        less: 'sudo less !/bin/sh',
        vim: 'sudo vim -c \':!/bin/sh\''
    },

    // Each template returns the parts of the box that vary by vulnerability
    // type — the rest (codename/title/brief/flag/objectives header) is
    // assembled once in generate(). `path` is the field the form's single
    // free-text input maps to (binary path, script path...), ignored where
    // not applicable (passwd_writable is a fixed path).
    templates: {
        suid_misuse(path, flag) {
            const bin = path || '/usr/local/bin/backup-tool';
            const fs = window.BOXBUILDER.baseFS(flag);
            window.BOXBUILDER.placeFile(fs, bin, window.BOXBUILDER.SUID_BIN({ exploit: 'custom_suid_exploit' }));
            return {
                fs,
                wins: [{ type: 'custom_suid_exploit' }],
                sudoers: undefined,
                objectives: ['Trouver le binaire SUID mal configuré', 'L\'exécuter directement', 'Obtenir un shell root'],
                hints: [`Vérifie les binaires SUID : find / -perm -4000 2>/dev/null`, `${bin} n'a rien à faire avec le bit SUID root.`, `Lance-le directement : ${bin}`],
                debrief: {
                    vuln: 'Binaire SUID mal configuré',
                    why: `${bin} porte le bit SUID root alors qu'il n'en a pas besoin — l'exécuter donne directement un shell root, comme un PoC de faille noyau simulé (PwnKit).`,
                    fix: `Retire le bit SUID (chmod u-s ${bin}) sauf nécessité absolue, et audite régulièrement les binaires SUID du système.`,
                    link: 'https://gtfobins.github.io/'
                },
                harden: { type: 'unset_suid', target: bin, obj: `Retire le bit SUID de ${bin}`, hint: `chmod u-s ${bin}` }
            };
        },
        cron_hijack(path, flag) {
            const script = path || '/opt/task.sh';
            const fs = window.BOXBUILDER.baseFS(flag);
            fs['/etc'].children.push('crontab');
            fs['/etc/crontab'] = { type: 'file', owner: 'root', mode: '644', content: `# /etc/crontab\nSHELL=/bin/sh\nPATH=/usr/sbin:/usr/bin:/sbin:/bin\n\n*  *  *  *  *  root  ${script}\n` };
            window.BOXBUILDER.placeFile(fs, script, { type: 'file', owner: 'root', mode: '777', writable_by_all: true, content: '#!/bin/sh\necho "tick" >> /var/log/task.log\n' });
            return {
                fs,
                wins: [{ type: 'cron_hijack', path: script }],
                objectives: ['Lire /etc/crontab', `Repérer que ${script} est accessible en écriture`, 'Le réécrire puis attendre cron'],
                hints: ['cat /etc/crontab liste les jobs planifiés.', `${script} tourne en root chaque minute et est world-writable.`, `echo "cp /bin/sh /tmp/rootsh; chmod +s /tmp/rootsh" > ${script} — puis tape "wait".`],
                debrief: {
                    vuln: 'Script cron accessible en écriture pour tous',
                    why: `root exécute ${script} chaque minute via cron, mais le script est modifiable par n'importe quel utilisateur. L'écraser exécute du code arbitraire en root au prochain déclenchement.`,
                    fix: 'Les scripts appelés par un job root ne doivent jamais être group/world-writable (chmod 700, chown root:root).',
                    link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation'
                },
                harden: { type: 'lock_perms', target: script, obj: `Rends ${script} non modifiable par tous`, hint: `chmod 700 ${script}` }
            };
        },
        passwd_writable(_path, flag) {
            const fs = window.BOXBUILDER.baseFS(flag);
            fs['/etc/passwd'] = { type: 'file', owner: 'root', mode: '666', writable_by_all: true, content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' };
            fs['/usr/bin/su'] = window.BOXBUILDER.SUID_BIN();
            fs['/usr/bin'].children.push('su');
            return {
                fs,
                wins: [{ type: 'passwd_write' }],
                objectives: ['Constater que /etc/passwd est modifiable', 'Ajouter un utilisateur UID 0 sans mot de passe', 'su vers ce compte'],
                hints: ['ls -la /etc/passwd — le fichier accepte l\'écriture pour tous.', 'echo \'r00t::0:0::/root:/bin/bash\' >> /etc/passwd', 'su r00t'],
                debrief: {
                    vuln: '/etc/passwd accessible en écriture pour tous',
                    why: 'N\'importe quel utilisateur peut ajouter une ligne UID 0 sans mot de passe et devenir root via su.',
                    fix: '/etc/passwd doit rester en mode 644, propriété root:root, jamais world-writable.',
                    link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation'
                },
                harden: { type: 'lock_perms', target: '/etc/passwd', obj: 'Rends /etc/passwd non modifiable par tous', hint: 'chmod 644 /etc/passwd' }
            };
        },
        sudo_gtfobin(_path, flag, sudoBin) {
            const bin = sudoBin || 'find';
            const fs = window.BOXBUILDER.baseFS(flag);
            fs['/usr/bin/sudo'] = window.BOXBUILDER.SUID_BIN();
            fs['/usr/bin/' + bin] = window.BOXBUILDER.ELF_BIN();
            fs['/usr/bin'].children.push('sudo', bin);
            const payload = window.BOXBUILDER.SUDO_PAYLOADS[bin] || window.BOXBUILDER.SUDO_PAYLOADS.find;
            return {
                fs,
                sudoers: { player: [{ cmd: '/usr/bin/' + bin, nopasswd: true, runas: 'root' }] },
                wins: [{ type: 'sudo_shell' }],
                objectives: ['Vérifier tes droits sudo (sudo -l)', `Retrouver l'astuce GTFOBins pour ${bin}`, 'Obtenir un shell root'],
                hints: ['Essaie : sudo -l', `${bin} est listé sur GTFOBins comme binaire capable d'ouvrir un shell.`, `Payload : ${payload}`],
                debrief: {
                    vuln: `Sudoers NOPASSWD sur ${bin} (GTFOBins)`,
                    why: `sudo autorise ${bin} sans mot de passe. GTFOBins liste ${bin} parmi les binaires qui peuvent faire spawn un shell, donnant un accès root direct.`,
                    fix: `Retire l'entrée NOPASSWD pour ${bin}, ou restreins ses arguments via sudoers si son usage privilégié est réellement nécessaire.`,
                    link: 'https://gtfobins.github.io/gtfobins/' + bin + '/'
                },
                harden: undefined
            };
        },
        path_hijack(path, flag, _sudoBin, hijackCmd) {
            const helper = path || '/usr/local/bin/status-helper';
            const cmd = (hijackCmd || 'ps').trim() || 'ps';
            const fs = window.BOXBUILDER.baseFS(flag);
            fs['/usr/bin/' + cmd] = window.BOXBUILDER.ELF_BIN();
            fs['/usr/bin'].children.push(cmd);
            window.BOXBUILDER.placeFile(fs, helper, {
                type: 'file', owner: 'root', mode: '4755', suid: true,
                content: `ELF binary (status helper)\nEmbedded strings:\n  system("${cmd}");\n`,
                calls_unqualified: cmd
            });
            return {
                fs,
                wins: [{ type: 'path_hijack', target: helper, hijack_cmd: cmd }],
                objectives: ['Trouver le binaire SUID', `Constater qu'il appelle "${cmd}" sans chemin absolu`, 'Détourner le $PATH avec un faux binaire', 'Exécuter le binaire SUID'],
                hints: [
                    `find / -perm -4000 2>/dev/null révèle ${helper}.`,
                    `strings ${helper} montre un appel système à "${cmd}" sans chemin absolu (pas /usr/bin/${cmd}).`,
                    `Fabrique un faux ${cmd} dans /tmp qui lance un shell, place /tmp en tête du $PATH, puis relance ${helper}.`
                ],
                debrief: {
                    vuln: `Binaire SUID appelant "${cmd}" sans chemin absolu (PATH hijack)`,
                    why: `${helper} est SUID root mais invoque "${cmd}" sans chemin absolu — il fait confiance au $PATH de l'appelant. Un faux ${cmd} placé dans un dossier antérieur du $PATH s'exécute donc en root à sa place.`,
                    fix: `Toujours invoquer les commandes externes par chemin absolu (/usr/bin/${cmd}) dans un binaire privilégié, ou fixer un $PATH sûr avant tout system()/exec().`,
                    link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation#relative-path'
                },
                harden: undefined
            };
        }
    },

    // Builds the full box object (schema matched against GAME_CUSTOM.validate())
    // and returns it pretty-printed, ready to paste into #customJsonInput.
    generate(form) {
        const codename = (form.codename || 'custom-01').trim();
        const flag = (form.flag || `flag{${codename.replace(/[^a-z0-9]+/gi, '_')}}`).trim();
        const tpl = this.templates[form.template] || this.templates.suid_misuse;
        const part = tpl(form.path && form.path.trim(), flag, form.sudoBin, form.hijackCmd);
        const box = {
            codename,
            title: (form.title || codename).trim(),
            brief: (form.brief || '').trim() || 'Box personnalisée générée par l\'assistant visuel.',
            user: 'player',
            host: codename,
            cwd: '/home/player',
            objectives: part.objectives,
            hints: part.hints,
            flag,
            fs: part.fs,
            wins: part.wins,
            debrief: part.debrief
        };
        if (part.sudoers) box.sudoers = part.sudoers;
        if (part.harden) box.harden = part.harden;
        return JSON.stringify(box, null, 2);
    },

    // ── DOM wiring ────────────────────────────────────────────────────────
    init() {
        const pasteBtn = document.getElementById('customModePasteBtn');
        const buildBtn = document.getElementById('customModeBuildBtn');
        const graphBtn = document.getElementById('customModeGraphBtn');
        const buildPanel = document.getElementById('customBuildPanel');
        const graphPanel = document.getElementById('customGraphPanel');
        const jsonInput = document.getElementById('customJsonInput');
        const importActions = jsonInput ? jsonInput.nextElementSibling : null;
        if (!pasteBtn || !buildBtn || !buildPanel || !jsonInput) return;

        const tabs = [
            { btn: pasteBtn, panel: null },
            { btn: buildBtn, panel: buildPanel },
            { btn: graphBtn, panel: graphPanel }
        ];
        // Exposed so boxeditor.js's own button can switch tabs without
        // duplicating this logic; also used internally after "Generate".
        const showMode = (activeBtn) => {
            tabs.forEach(({ btn, panel }) => {
                if (!btn) return;
                const active = btn === activeBtn;
                btn.classList.toggle('is-active', active);
                if (panel) panel.hidden = !active;
            });
            const onPaste = activeBtn === pasteBtn;
            jsonInput.hidden = !onPaste;
            if (importActions) importActions.hidden = !onPaste;
        };
        window.BOXBUILDER.showMode = showMode;
        window.BOXBUILDER.showPasteTab = () => showMode(pasteBtn);

        pasteBtn.addEventListener('click', () => showMode(pasteBtn));
        buildBtn.addEventListener('click', () => showMode(buildBtn));
        if (graphBtn) graphBtn.addEventListener('click', () => showMode(graphBtn));

        const tplSelect = document.getElementById('cbTemplate');
        const pathField = document.getElementById('cbPathField');
        const pathLabel = document.getElementById('cbPathLabel');
        const pathInput = document.getElementById('cbPath');
        const sudoBinField = document.getElementById('cbSudoBinField');
        const hijackCmdField = document.getElementById('cbHijackCmdField');

        const PATH_DEFAULTS = {
            suid_misuse: { path: '/usr/local/bin/backup-tool', labelKey: 'cbPathLabelSuid' },
            cron_hijack: { path: '/opt/task.sh', labelKey: 'cbPathLabelCron' },
            passwd_writable: null,
            sudo_gtfobin: null,
            path_hijack: { path: '/usr/local/bin/status-helper', labelKey: 'cbPathLabelHelper' }
        };

        const syncTemplateFields = () => {
            const kind = tplSelect.value;
            const cfg = PATH_DEFAULTS[kind];
            if (cfg) {
                pathField.hidden = false;
                if (pathLabel) pathLabel.textContent = (window.t ? window.t(cfg.labelKey) : cfg.labelKey);
                if (!pathInput.value || Object.values(PATH_DEFAULTS).some(c => c && c.path === pathInput.value)) {
                    pathInput.value = cfg.path;
                }
            } else {
                pathField.hidden = true;
            }
            sudoBinField.hidden = kind !== 'sudo_gtfobin';
            hijackCmdField.hidden = kind !== 'path_hijack';
        };
        if (tplSelect) {
            tplSelect.addEventListener('change', syncTemplateFields);
            syncTemplateFields();
        }

        const generateBtn = document.getElementById('cbGenerateBtn');
        const msgEl = document.getElementById('cbMsg');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                const form = {
                    template: tplSelect ? tplSelect.value : 'suid_misuse',
                    codename: document.getElementById('cbCodename').value,
                    title: document.getElementById('cbTitle').value,
                    brief: document.getElementById('cbBrief').value,
                    flag: document.getElementById('cbFlag').value,
                    path: pathInput ? pathInput.value : '',
                    sudoBin: document.getElementById('cbSudoBin').value,
                    hijackCmd: document.getElementById('cbHijackCmd').value
                };
                const json = this.generate(form);
                jsonInput.value = json;
                showMode(pasteBtn);
                jsonInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (msgEl) { msgEl.textContent = ''; }
            });
        }
    }
};
