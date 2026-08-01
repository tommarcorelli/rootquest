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
        title: { en: 'Box-01 · SUID Bit Bandit', fr: 'Box-01 · Le voleur de bit SUID', es: 'Box-01 · El bandido del bit SUID' },
        brief: {
            en: "You landed a shell as low-priv user 'player'. Some binary owned by root has SUID set and shouldn't. Find it, abuse it.",
            fr: "Tu as un shell en tant que 'player'. Un binaire root possède un SUID qui ne devrait pas être là. Trouve-le et exploite-le.",
            es: "Tienes un shell como el usuario sin privilegios 'player'. Algún binario propiedad de root tiene el bit SUID activado y no debería. Encuéntralo y explótalo."
        },
        user: 'player',
        host: 'box-01',
        cwd: '/home/player',
        objectives: {
            en: ['Enumerate SUID binaries', 'Identify the vulnerable one', 'Get a root shell'],
            fr: ['Énumérer les binaires SUID', 'Identifier le binaire vulnérable', 'Obtenir un shell root'],
            es: ['Enumerar los binarios SUID', 'Identificar el vulnerable', 'Obtener un shell root']
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
            ],
            es: [
                'Los binarios SUID tienen el bit "s". Prueba: find / -perm -4000 2>/dev/null',
                '/usr/bin/find con SUID root es peligroso. Consulta GTFOBins para "find".',
                'find puede ejecutar comandos. Prueba: find . -exec /bin/sh -p \\;'
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
            obj: { en: 'Remove the SUID bit from /usr/bin/find', fr: 'Retire le bit SUID de /usr/bin/find', es: 'Retira el bit SUID de /usr/bin/find' },
            hint: { en: 'chmod u-s /usr/bin/find', fr: 'chmod u-s /usr/bin/find', es: 'chmod u-s /usr/bin/find' }
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
            },
            es: {
                vuln: 'Mala configuración SUID (find)',
                why: '/usr/bin/find tenía el bit SUID activado como root. GTFOBins incluye find entre los binarios capaces de abrir un shell vía -exec, así que cualquier usuario que lo ejecute hereda privilegios de root en vez de solo listar archivos.',
                fix: 'Retira el bit SUID salvo necesidad estricta (chmod u-s /usr/bin/find), y audita regularmente los binarios SUID con find / -perm -4000. Nunca des el SUID a una herramienta genérica capaz de ejecutar comandos arbitrarios.',
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
        title: { en: 'Box-02 · The Cron Whisperer', fr: 'Box-02 · Le chuchoteur de cron', es: 'Box-02 · El susurrador de cron' },
        brief: {
            en: 'A scheduled job runs every minute as root. Somewhere a script it executes is world-writable. Hijack the payload.',
            fr: 'Un job planifié tourne toutes les minutes en root. Un script qu\'il exécute est accessible en écriture pour tous. Détourne le payload.',
            es: 'Una tarea programada se ejecuta cada minuto como root. En algún lugar, un script que ejecuta tiene permiso de escritura para todos. Secuestra el payload.'
        },
        user: 'player',
        host: 'box-02',
        cwd: '/home/player',
        objectives: {
            en: ['Read /etc/crontab', 'Find a writable script called by root', 'Overwrite it and wait for cron'],
            fr: ['Lire /etc/crontab', 'Trouver un script accessible en écriture appelé par root', 'Réécrire ce script et attendre cron'],
            es: ['Leer /etc/crontab', 'Encontrar un script escribible llamado por root', 'Sobrescribirlo y esperar a cron']
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
            ],
            es: [
                'cat /etc/crontab muestra las tareas del sistema.',
                '/opt/backup.sh se ejecuta como root cada minuto. Comprueba sus permisos: ls -la /opt/backup.sh',
                'Sobrescribe el script: echo "cp /bin/sh /tmp/rootsh; chmod +s /tmp/rootsh" > /opt/backup.sh — luego escribe "wait".'
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
            obj: { en: 'Make /opt/backup.sh no longer world-writable', fr: 'Rends /opt/backup.sh non modifiable par tous', es: 'Haz que /opt/backup.sh ya no sea escribible por todos' },
            hint: { en: 'chmod 700 /opt/backup.sh', fr: 'chmod 700 /opt/backup.sh', es: 'chmod 700 /opt/backup.sh' }
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
            },
            es: {
                vuln: 'Script de cron escribible por todos',
                why: 'El crontab de root ejecuta /opt/backup.sh cada minuto, pero el script en sí es escribible por cualquier usuario (modo 777). Sobrescribirlo permite ejecutar código arbitrario con privilegios de root la próxima vez que cron se dispare.',
                fix: 'Los scripts ejecutados por root nunca deben ser escribibles por el grupo ni por todos. Fija el propietario y los permisos correctos (chmod 700, chown root:root) en cualquier archivo referenciado por una tarea cron privilegiada, y audita regularmente /etc/crontab y las entradas de cron.d.',
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
        title: { en: 'Box-03 · Capable of Everything', fr: 'Box-03 · Capable de tout', es: 'Box-03 · Capaz de todo' },
        brief: {
            en: 'Traditional SUID audit shows nothing juicy. But capabilities are another attack surface — inspect them.',
            fr: 'L\'audit SUID classique ne donne rien. Mais les capabilities sont une autre surface d\'attaque — inspecte-les.',
            es: 'La auditoría SUID tradicional no muestra nada interesante. Pero las capabilities son otra superficie de ataque — inspecciónalas.'
        },
        user: 'player',
        host: 'box-03',
        cwd: '/home/player',
        objectives: {
            en: ['List capabilities on the system', 'Identify the risky binary', 'Abuse it to setuid(0)'],
            fr: ['Lister les capabilities du système', 'Identifier le binaire à risque', 'L\'exploiter pour setuid(0)'],
            es: ['Listar las capabilities del sistema', 'Identificar el binario de riesgo', 'Explotarlo para setuid(0)']
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
            ],
            es: [
                'Prueba: getcap -r / 2>/dev/null',
                'python3 con cap_setuid+ep te permite cambiar tu UID a 0.',
                'Payload: python3 -c \'import os; os.setuid(0); os.system("/bin/sh")\''
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
            obj: { en: 'Strip the cap_setuid capability from python3', fr: 'Retire la capability cap_setuid de python3', es: 'Retira la capability cap_setuid de python3' },
            hint: { en: 'setcap -r /usr/bin/python3', fr: 'setcap -r /usr/bin/python3', es: 'setcap -r /usr/bin/python3' }
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
            },
            es: {
                vuln: 'Capability Linux cap_setuid+ep en python3',
                why: 'Las capabilities de Linux otorgan a un binario poderes de root parciales sin SUID completo. python3 tenía cap_setuid: puede llamar a setuid(0) directamente desde un script y abrir un shell root, saltándose por completo las comprobaciones de permisos habituales.',
                fix: 'Retira las capabilities innecesarias con setcap -r /usr/bin/python3, y trata cap_setuid/cap_setgid en un intérprete (python, perl, ruby, node) como un SUID root completo. Audita regularmente con getcap -r /.',
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
        title: { en: 'Box-04 · PATH of Least Resistance', fr: 'Box-04 · Le chemin de moindre résistance', es: 'Box-04 · El camino de menor resistencia' },
        brief: {
            en: 'A SUID helper /usr/local/bin/status calls an external command without an absolute path. Rewrite the PATH.',
            fr: 'Un helper SUID /usr/local/bin/status appelle une commande externe sans chemin absolu. Réécris le PATH.',
            es: 'Un ayudante SUID /usr/local/bin/status llama a un comando externo sin ruta absoluta. Reescribe el PATH.'
        },
        user: 'player',
        host: 'box-04',
        cwd: '/home/player',
        objectives: {
            en: ['Find SUID binaries', 'Analyze what /usr/local/bin/status calls', 'Hijack the PATH to run your own binary'],
            fr: ['Trouver les binaires SUID', 'Analyser ce qu\'appelle /usr/local/bin/status', 'Détourner le PATH avec ton propre binaire'],
            es: ['Encontrar los binarios SUID', 'Analizar qué llama /usr/local/bin/status', 'Secuestrar el PATH con tu propio binario']
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
            ],
            es: [
                'Prueba: find / -perm -4000 2>/dev/null y luego strings /usr/local/bin/status',
                '/usr/local/bin/status llama a "ps" sin ruta absoluta.',
                'Payload:\n  echo \'#!/bin/sh\' > /tmp/ps\n  echo \'/bin/sh\' >> /tmp/ps\n  chmod +x /tmp/ps\n  export PATH=/tmp:$PATH\n  /usr/local/bin/status'
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
            obj: { en: 'Remove the SUID bit from /usr/local/bin/status', fr: 'Retire le bit SUID de /usr/local/bin/status', es: 'Retira el bit SUID de /usr/local/bin/status' },
            hint: { en: 'chmod u-s /usr/local/bin/status', fr: 'chmod u-s /usr/local/bin/status', es: 'chmod u-s /usr/local/bin/status' }
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
            },
            es: {
                vuln: 'Secuestro de PATH contra un ayudante SUID',
                why: '/usr/local/bin/status es SUID root pero llama a "ps" sin ruta absoluta. El programa confía en la variable de entorno PATH, así que colocar un "ps" malicioso antes en el PATH hace que el binario SUID ejecute código controlado por el atacante como root.',
                fix: 'Nunca llames a comandos externos por su nombre relativo desde código privilegiado — usa siempre rutas absolutas (/bin/ps). Elimina o sanea el PATH antes de ejecutar cualquier cosa como root, e inspecciona los binarios SUID con strings para detectar llamadas a comandos sin ruta.',
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
        title: { en: 'Box-05 · Sudo, But Too Much', fr: 'Box-05 · Sudo, un peu trop généreux', es: 'Box-05 · Sudo, un poco demasiado generoso' },
        brief: {
            en: 'The sysadmin gave you sudo access to a text editor. Editors that shell out are your best friend.',
            fr: "L'admin t'a donné sudo sur un éditeur de texte. Les éditeurs qui lancent un shell sont tes meilleurs amis.",
            es: 'El sysadmin te dio acceso sudo a un editor de texto. Los editores que abren un shell son tu mejor amigo.'
        },
        user: 'player',
        host: 'box-05',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Identify the abusable command', 'Escape to a root shell via the editor'],
            fr: ['Vérifier tes droits sudo', 'Identifier la commande exploitable', 'Sortir en root via l\'éditeur'],
            es: ['Comprobar tus permisos sudo', 'Identificar el comando explotable', 'Escapar a un shell root vía el editor']
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
            ],
            es: [
                'Prueba: sudo -l',
                'Puedes ejecutar /usr/bin/vim como root sin contraseña. Vim puede abrir un shell.',
                'Payload: sudo vim -c \':!/bin/sh\''
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
            },
            es: {
                vuln: 'Mala configuración sudoers — NOPASSWD en vim',
                why: "El archivo sudoers permite a 'player' ejecutar /usr/bin/vim como root sin contraseña. Vim puede ejecutar comandos de shell (:! o :!sh), que heredan los privilegios elevados de vim — un shell root instantáneo.",
                fix: 'Nunca des sudo sobre editores, intérpretes o paginadores genéricos listados en GTFOBins. Si un editor debe ejecutarse como root, restríngelo (p. ej. rvim, sudoedit) o desactiva la salida a shell.',
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
        title: { en: 'Box-06 · Passwd the Parcel', fr: 'Box-06 · Le passwd de la discorde', es: 'Box-06 · El passwd de la discordia' },
        brief: {
            en: '/etc/passwd should never be writable by users. On this box, it is. Add yourself a root.',
            fr: '/etc/passwd ne devrait jamais être modifiable par les utilisateurs. Ici, il l\'est. Ajoute-toi un root.',
            es: '/etc/passwd nunca debería ser escribible por los usuarios. En esta box, lo es. Añádete una cuenta root.'
        },
        user: 'player',
        host: 'box-06',
        cwd: '/home/player',
        objectives: {
            en: ['Check /etc/passwd permissions', 'Append a UID-0 account with no password', 'Switch to it'],
            fr: ['Vérifier les permissions de /etc/passwd', 'Ajouter un compte UID 0 sans mot de passe', 'Basculer dessus'],
            es: ['Comprobar los permisos de /etc/passwd', 'Añadir una cuenta UID 0 sin contraseña', 'Cambiar a esa cuenta']
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
            ],
            es: [
                'ls -la /etc/passwd — ¿es escribible? Un segundo campo vacío significa "sin contraseña".',
                'Una línea con el segundo campo vacío y UID 0 es un root sin contraseña: nombre::0:0::/root:/bin/bash',
                'echo \'r00t::0:0:pwned:/root:/bin/bash\' >> /etc/passwd  luego  su r00t'
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
            obj: { en: 'Restore safe permissions on /etc/passwd (644)', fr: 'Restaure des permissions sûres sur /etc/passwd (644)', es: 'Restaura permisos seguros en /etc/passwd (644)' },
            hint: { en: 'chmod 644 /etc/passwd', fr: 'chmod 644 /etc/passwd', es: 'chmod 644 /etc/passwd' }
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
            },
            es: {
                vuln: '/etc/passwd escribible por todos',
                why: '/etc/passwd estaba en modo 666, así que cualquier usuario podía añadir su propia cuenta. Una línea con el campo de contraseña vacío y UID 0 es una cuenta root sin contraseña — basta un su para convertirse en root, sin necesidad de crackear nada.',
                fix: '/etc/passwd debe estar en 644 y ser propiedad de root. Nunca relajes sus permisos. Las contraseñas van en /etc/shadow (640, root:shadow); un campo de contraseña vacío en passwd es un fallo crítico.',
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
        title: { en: 'Box-07 · Awk-ward Privileges', fr: 'Box-07 · Des privilèges Awk-ward', es: 'Box-07 · Privilegios Awk-wardos' },
        brief: {
            en: 'sudo lets you run a text-processing tool as root. Many of them can shell out. Find the one you have.',
            fr: 'sudo t\'autorise un outil de traitement de texte en root. Beaucoup peuvent ouvrir un shell. Trouve le tien.',
            es: 'sudo te permite ejecutar una herramienta de procesamiento de texto como root. Muchas pueden abrir un shell. Encuentra la tuya.'
        },
        user: 'player',
        host: 'box-07',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recognise the GTFOBins-listed binary', 'Spawn a root shell from it'],
            fr: ['Vérifier tes droits sudo', 'Reconnaître le binaire listé sur GTFOBins', 'En faire jaillir un shell root'],
            es: ['Comprobar tus permisos sudo', 'Reconocer el binario listado en GTFOBins', 'Hacer brotar un shell root desde él']
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
            ],
            es: [
                'Prueba: sudo -l',
                'awk puede ejecutar comandos arbitrarios con su bloque BEGIN. Consulta GTFOBins para "awk".',
                'Payload: sudo awk \'BEGIN{system("/bin/sh")}\''
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
            },
            es: {
                vuln: 'Mala configuración sudoers — NOPASSWD en awk',
                why: "'player' podía ejecutar awk como root. El bloque BEGIN{system(...)} de awk ejecuta comandos de shell arbitrarios heredando los privilegios root de sudo — un shell root instantáneo, igual que vim, less, find, env y decenas más en GTFOBins.",
                fix: 'Nunca des sudo sobre intérpretes o herramientas de texto genéricas. Restringe las reglas sudo a binarios concretos, que no abran shell, con argumentos fijos, y verifica cada comando permitido contra GTFOBins.',
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
        title: { en: 'Box-08 · Kernel Panic Room', fr: 'Box-08 · La salle du kernel', es: 'Box-08 · La sala del kernel' },
        brief: {
            en: 'No SUID, no sudo, no caps. But the system is old and a public PoC is sitting in your home. Some vulns are in the software itself.',
            fr: 'Pas de SUID, pas de sudo, pas de caps. Mais le système est vieux et un PoC public traîne dans ton home. Certaines failles sont dans le logiciel lui-même.',
            es: 'Sin SUID, sin sudo, sin capabilities. Pero el sistema es viejo y hay una PoC pública en tu home. Algunas fallas están en el propio software.'
        },
        user: 'player',
        host: 'box-08',
        cwd: '/home/player',
        objectives: {
            en: ['Note the outdated system / pkexec version', 'Locate the exploit PoC', 'Run it to get root'],
            fr: ['Repérer le système / pkexec obsolète', 'Localiser le PoC de l\'exploit', 'L\'exécuter pour obtenir root'],
            es: ['Detectar el sistema / la versión de pkexec obsoleta', 'Localizar la PoC del exploit', 'Ejecutarla para obtener root']
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
            ],
            es: [
                'Lee HINT.txt y anota la versión de polkit/pkexec — CVE-2021-4034 (PwnKit) la afecta.',
                'Hay una PoC compilada en tu directorio home: ls -la',
                'Ejecútala: ./pwnkit'
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
            obj: { en: 'Drop the SUID bit from the vulnerable pkexec', fr: 'Retire le bit SUID du pkexec vulnérable', es: 'Retira el bit SUID del pkexec vulnerable' },
            hint: { en: 'chmod u-s /usr/bin/pkexec', fr: 'chmod u-s /usr/bin/pkexec', es: 'chmod u-s /usr/bin/pkexec' }
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
            },
            es: {
                vuln: 'Escalada de privilegios local sin parchear (CVE-2021-4034, PwnKit)',
                why: 'pkexec de polkit 0.105 gestiona mal el número de argumentos, permitiendo a un usuario local ejecutar código como root. Cuando SUID/sudo/capabilities están limpios, un componente desactualizado y vulnerable se convierte en la puerta de entrada — el nivel de parche forma parte de la superficie de ataque.',
                fix: 'Parchea y mantén los sistemas actualizados (apt upgrade). Sigue los avisos de seguridad de componentes SUID como pkexec/polkit. Como solución temporal, retira el bit SUID de pkexec hasta parchear, y vigila la aparición de binarios de exploits conocidos en home/tmp.',
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
        title: { en: 'Box-09 · Leftover Credentials', fr: 'Box-09 · Les identifiants oubliés', es: 'Box-09 · Credenciales olvidadas' },
        brief: {
            en: 'A plaintext password is rotting in a config file. It belongs to a service account — and that account was given too much sudo. Chain it.',
            fr: 'Un mot de passe en clair pourrit dans un fichier de conf. Il appartient à un compte de service — à qui on a donné trop de sudo. Enchaîne.',
            es: 'Una contraseña en texto plano se pudre en un archivo de configuración. Pertenece a una cuenta de servicio — a la que le dieron demasiado sudo. Encadénalo.'
        },
        user: 'player',
        host: 'box-09',
        cwd: '/home/player',
        objectives: {
            en: ['Enumerate readable files under /opt', 'Recover the service credentials', 'su to that account and abuse its sudo rights'],
            fr: ['Énumérer les fichiers lisibles sous /opt', 'Récupérer les identifiants du service', 'su vers ce compte et abuser de ses droits sudo'],
            es: ['Enumerar los archivos legibles bajo /opt', 'Recuperar las credenciales del servicio', 'Hacer su a esa cuenta y abusar de sus derechos sudo']
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
            ],
            es: [
                'Mira la configuración de la app web: cat /opt/app/config.php — anota el usuario y contraseña de la BD.',
                'Esa contraseña se reutiliza para la cuenta "svc". Cambia a ella: su svc',
                'Como svc, comprueba sudo -l — puedes ejecutar bash como root: sudo bash'
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
            },
            es: {
                vuln: 'Reutilización de credenciales + cuenta de servicio sobreprivilegiada',
                why: 'Una contraseña en texto plano estaba en un archivo de configuración legible por todos. La cuenta svc la reutilizaba para su login del sistema, y svc podía ejecutar bash vía sudo. Encadenar enumeración → movimiento lateral → abuso de sudo convierte un secreto filtrado en root completo.',
                fix: 'Mantén los secretos fuera del código fuente y de archivos legibles por todos (usa un vault / variables de entorno con permisos estrictos). Exige credenciales únicas por servicio, y limita sudo al mínimo — nunca des sudo sobre un shell.',
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
        title: { en: 'Box-10 · Whale of a Privilege', fr: 'Box-10 · Une baleine de privilèges', es: 'Box-10 · Una ballena de privilegios' },
        brief: {
            en: 'You are in the "docker" group. That is effectively root — you can mount the host filesystem inside a container you control.',
            fr: 'Tu es dans le groupe "docker". C\'est root en pratique — tu peux monter le système hôte dans un conteneur que tu contrôles.',
            es: 'Estás en el grupo "docker". Eso equivale a root en la práctica — puedes montar el sistema de archivos del host dentro de un contenedor que controlas.'
        },
        user: 'player',
        host: 'box-10',
        cwd: '/home/player',
        objectives: {
            en: ['Confirm your group membership', 'Run a container that mounts the host root', 'chroot into it as root'],
            fr: ['Confirmer ton appartenance au groupe', 'Lancer un conteneur qui monte la racine hôte', 'chroot dedans en root'],
            es: ['Confirmar tu pertenencia al grupo', 'Lanzar un contenedor que monte la raíz del host', 'Hacer chroot dentro como root']
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
            ],
            es: [
                'Comprueba tus grupos: id — estar en "docker" es una escalada de privilegios conocida.',
                'Un contenedor puede montar todo el host: -v /:/mnt',
                'Payload: docker run -v /:/mnt -it alpine chroot /mnt sh'
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
            },
            es: {
                vuln: 'Pertenencia al grupo docker',
                why: 'El grupo docker otorga control total sobre el demonio Docker, que se ejecuta como root. Montar el sistema de archivos del host en un contenedor (-v /:/mnt) y hacer chroot dentro da un shell root sin restricciones en el host. grupo docker ≈ root.',
                fix: 'Trata la pertenencia al grupo docker como equivalente a root y concédela solo a administradores de confianza. Prefiere Docker rootless o herramientas más granulares, y audita quién está en los grupos docker/lxd/kvm.',
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
        title: { en: 'Box-11 · Preload Pandemonium', fr: 'Box-11 · Chaos au préchargement', es: 'Box-11 · Caos en la precarga' },
        brief: {
            en: 'sudo lets you run one harmless-looking binary as root — but it also kept LD_PRELOAD in the environment. Load your own library.',
            fr: 'sudo t\'autorise un binaire d\'apparence inoffensive en root — mais il a aussi gardé LD_PRELOAD dans l\'environnement. Charge ta propre bibliothèque.',
            es: 'sudo te permite ejecutar un binario de aspecto inofensivo como root — pero también conservó LD_PRELOAD en el entorno. Carga tu propia biblioteca.'
        },
        user: 'player',
        host: 'box-11',
        cwd: '/home/player',
        objectives: {
            en: ['Read your sudo rights and spot env_keep', 'Build a shared object that spawns a shell', 'Preload it through sudo'],
            fr: ['Lire tes droits sudo et repérer env_keep', 'Construire un objet partagé qui ouvre un shell', 'Le précharger via sudo'],
            es: ['Leer tus permisos sudo y detectar env_keep', 'Construir un objeto compartido que abra un shell', 'Precargarlo a través de sudo']
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
            ],
            es: [
                'Ejecuta sudo -l — anota "env_keep+=LD_PRELOAD" y el comando NOPASSWD que puedes ejecutar.',
                'Escribe una pequeña biblioteca cuya _init() haga setuid(0); system("/bin/sh"), y compílala:\n  echo \'void _init(){setuid(0);system("/bin/sh");}\' > /tmp/x.c\n  gcc -shared -fPIC -nostartfiles -o /tmp/x.so /tmp/x.c',
                'Precárgala a través del comando permitido por sudo:\n  sudo LD_PRELOAD=/tmp/x.so apache2ctl'
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
            },
            es: {
                vuln: 'sudo env_keep conserva LD_PRELOAD',
                why: 'La directiva Defaults de sudoers mantenía LD_PRELOAD en el entorno. Incluso un comando NOPASSWD restringido se convierte en ejecución de código como root: un objeto compartido cuya _init() hace setuid(0)/system se carga antes que el binario objetivo y se ejecuta con privilegios de root.',
                fix: 'Nunca añadas LD_PRELOAD / LD_LIBRARY_PATH a env_keep. Confía en env_reset por defecto, mantén las listas de comandos sudo permitidos estrictas, y prefiere rutas completas con argumentos fijos para que ninguna variable de entorno peligrosa pueda colarse.',
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
        title: { en: 'Box-12 · Wildcard Gone Wild', fr: 'Box-12 · Le joker sauvage', es: 'Box-12 · El comodín salvaje' },
        brief: {
            en: 'A root cron archives a directory you can write to, using tar with a "*". Filenames can become tar options. Weaponise the wildcard.',
            fr: 'Un cron root archive un dossier où tu peux écrire, avec tar et un "*". Les noms de fichiers peuvent devenir des options tar. Arme le joker.',
            es: 'Un cron root archiva un directorio en el que puedes escribir, usando tar con un "*". Los nombres de archivo pueden convertirse en opciones de tar. Arma el comodín.'
        },
        user: 'player',
        host: 'box-12',
        cwd: '/home/player',
        objectives: {
            en: ['Read the root cron and its tar command', 'Drop a script plus crafted --checkpoint files', 'Wait for cron to run tar as root'],
            fr: ['Lire le cron root et sa commande tar', 'Déposer un script et des fichiers --checkpoint piégés', 'Attendre que cron lance tar en root'],
            es: ['Leer el cron root y su comando tar', 'Colocar un script y archivos --checkpoint fabricados', 'Esperar a que cron ejecute tar como root']
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
            ],
            es: [
                'cat /etc/crontab — root ejecuta: cd /home/player/share && tar -czf /var/backups/share.tar.gz *',
                'El "*" se expande a nombres de archivo, y tar trata --checkpoint-action=exec=... como una opción. Crea primero un script payload:\n  cd /home/player/share\n  echo \'cp /bin/bash /tmp/rootbash; chmod +s /tmp/rootbash\' > runme.sh',
                'Ahora fabrica los archivos-opción (el prefijo ./ evita que touch los trate como flags) para que tar ejecute tu script:\n  touch ./--checkpoint=1\n  touch \'./--checkpoint-action=exec=sh runme.sh\'\n  wait'
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
            },
            es: {
                vuln: 'Inyección de comodín en un cron tar de root',
                why: 'root ejecutaba tar ... * en un directorio que controlas. El shell expande "*" a los nombres de archivo, y tar lee --checkpoint / --checkpoint-action=exec=... como opciones de línea de comandos. Archivos nombrados como esas opciones hacen que tar ejecute tu script como root.',
                fix: 'Nunca uses comodines sin comillas en scripts privilegiados. Pasa una lista explícita de archivos o usa "--" y el prefijo ./ (tar ... -- *), evita ejecutar archivadores como root sobre directorios escribibles por el usuario, y prefiere APIs seguras en vez del globbing del shell.',
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
        title: { en: 'Box-13 · Keys to the Kingdom', fr: 'Box-13 · Les clés du royaume', es: 'Box-13 · Las llaves del reino' },
        brief: {
            en: 'A backup left root\'s SSH private key world-readable. If root accepts that key, you can just log in as root.',
            fr: 'Une sauvegarde a laissé la clé privée SSH de root lisible par tous. Si root accepte cette clé, tu peux simplement te connecter en root.',
            es: 'Una copia de seguridad dejó la clave privada SSH de root legible por todos. Si root acepta esa clave, puedes simplemente iniciar sesión como root.'
        },
        user: 'player',
        host: 'box-13',
        cwd: '/home/player',
        objectives: {
            en: ['Find readable files under /opt/backup', 'Recover root\'s private SSH key', 'Log in as root with it'],
            fr: ['Trouver les fichiers lisibles sous /opt/backup', 'Récupérer la clé privée SSH de root', 'Se connecter en root avec'],
            es: ['Encontrar los archivos legibles bajo /opt/backup', 'Recuperar la clave privada SSH de root', 'Iniciar sesión como root con ella']
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
            ],
            es: [
                'Busca material de claves olvidado: ls -la /opt/backup — id_rsa es legible por todos.',
                'cat /opt/backup/id_rsa — esa es la clave privada de root, y /root/.ssh/authorized_keys confía en ella.',
                'Úsala para iniciar sesión como root:\n  ssh -i /opt/backup/id_rsa root@localhost'
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
            },
            es: {
                vuln: 'Clave privada SSH de root legible por todos',
                why: 'Una tarea de copia de seguridad copió la clave privada de root a /opt/backup y la dejó legible por todos. Como /root/.ssh/authorized_keys confía en la clave pública correspondiente, cualquiera que pueda leer la clave privada puede autenticarse como root por SSH — sin contraseña, sin exploit.',
                fix: 'Las claves privadas deben estar en 600 y ser propiedad de su usuario; nunca las copies en texto plano a ubicaciones compartidas o de backup. Cifra las copias de seguridad, rota de inmediato cualquier clave expuesta, y audita los permisos del material de claves.',
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
        title: { en: 'Box-14 · Drop-in Privilege', fr: 'Box-14 · Privilège en drop-in', es: 'Box-14 · Privilegio en drop-in' },
        brief: {
            en: 'The /etc/sudoers.d directory is world-writable. sudo honours every rule dropped there — so write your own.',
            fr: 'Le dossier /etc/sudoers.d est modifiable par tous. sudo applique toute règle qu\'on y dépose — écris donc la tienne.',
            es: 'El directorio /etc/sudoers.d es escribible por todos. sudo respeta cualquier regla que se deposite ahí — así que escribe la tuya.'
        },
        user: 'player',
        host: 'box-14',
        cwd: '/home/player',
        objectives: {
            en: ['Notice /etc/sudoers.d is writable', 'Drop a NOPASSWD rule for yourself', 'Use sudo to get a root shell'],
            fr: ['Repérer que /etc/sudoers.d est modifiable', 'Déposer une règle NOPASSWD pour toi', 'Utiliser sudo pour un shell root'],
            es: ['Detectar que /etc/sudoers.d es escribible', 'Depositar una regla NOPASSWD para ti', 'Usar sudo para obtener un shell root']
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
            ],
            es: [
                'ls -la /etc/sudoers.d — el directorio es escribible por todos, y sudo lee cada archivo dentro.',
                "Deposita una regla que te lo conceda todo:\n  echo 'player ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/pwn",
                'Ahora escala:\n  sudo bash'
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
            obj: { en: 'Fix the permissions on /etc/sudoers.d (755)', fr: 'Corrige les permissions de /etc/sudoers.d (755)', es: 'Corrige los permisos de /etc/sudoers.d (755)' },
            hint: { en: 'chmod 755 /etc/sudoers.d', fr: 'chmod 755 /etc/sudoers.d', es: 'chmod 755 /etc/sudoers.d' }
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
            },
            es: {
                vuln: 'Directorio /etc/sudoers.d escribible por todos',
                why: 'sudo incluye cada archivo de /etc/sudoers.d. Al ser el directorio escribible por todos, cualquier usuario podía depositar un archivo que se otorgara NOPASSWD: ALL y abrir de inmediato un shell root — sin exploit, solo un permiso mal configurado.',
                fix: 'El directorio /etc/sudoers.d y sus archivos deben pertenecer a root en modo 755 / 440. Audita los drop-ins de sudo, valida con visudo -c, y alerta ante cualquier escritura en rutas de sudoers.',
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
        title: { en: 'Box-15 · Preload, Globally', fr: 'Box-15 · Préchargement global', es: 'Box-15 · Precarga global' },
        brief: {
            en: '/etc/ld.so.preload injects a library into every dynamically linked program — including SUID root ones. It is writable here.',
            fr: '/etc/ld.so.preload injecte une bibliothèque dans chaque programme lié dynamiquement — y compris les SUID root. Il est modifiable ici.',
            es: '/etc/ld.so.preload inyecta una biblioteca en cada programa enlazado dinámicamente — incluidos los SUID root. Aquí es escribible.'
        },
        user: 'player',
        host: 'box-15',
        cwd: '/home/player',
        objectives: {
            en: ['Spot the writable /etc/ld.so.preload', 'Build a library that pops a root shell', 'Trigger it via any SUID binary'],
            fr: ['Repérer /etc/ld.so.preload modifiable', 'Construire une bibliothèque qui ouvre un shell root', 'La déclencher via un binaire SUID'],
            es: ['Detectar el /etc/ld.so.preload escribible', 'Construir una biblioteca que abra un shell root', 'Dispararla vía cualquier binario SUID']
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
            ],
            es: [
                'ls -la /etc/ld.so.preload — escribible por todos. Cada binario SUID carga lo que ahí figure.',
                'Construye la biblioteca y regístrala:\n  echo \'void _init(){setuid(0);system("/bin/sh");}\' > /tmp/x.c\n  gcc -shared -fPIC -nostartfiles -o /tmp/x.so /tmp/x.c\n  echo /tmp/x.so > /etc/ld.so.preload',
                'Dispárala ejecutando cualquier binario SUID:\n  /usr/bin/passwd'
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
            obj: { en: 'Remove write access to /etc/ld.so.preload (644)', fr: 'Retire l\'accès en écriture à /etc/ld.so.preload (644)', es: 'Retira el acceso de escritura a /etc/ld.so.preload (644)' },
            hint: { en: 'chmod 644 /etc/ld.so.preload', fr: 'chmod 644 /etc/ld.so.preload', es: 'chmod 644 /etc/ld.so.preload' }
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
            },
            es: {
                vuln: '/etc/ld.so.preload escribible por todos',
                why: 'El enlazador dinámico precarga cada biblioteca listada en /etc/ld.so.preload en todos los programas enlazados dinámicamente, incluidos los SUID root. Con el archivo escribible por todos, un atacante lo apunta a un .so malicioso cuyo constructor hace setuid(0)/system — el siguiente binario SUID lo ejecuta como root.',
                fix: '/etc/ld.so.preload debe pertenecer a root en modo 644 (o no existir). Vigila sus cambios, audita los binarios SUID, y valora montar la configuración sensible en solo lectura o usar una política MAC (AppArmor/SELinux).',
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
        title: { en: 'Box-16 · Find, Reprised', fr: 'Box-16 · Find, la reprise', es: 'Box-16 · Find, la reprise' },
        brief: {
            en: 'sudo lets you run find as root this time — no SUID bit needed. Same binary, same trick, different door.',
            fr: 'Cette fois sudo t\'autorise find en root — pas besoin de bit SUID. Même binaire, même astuce, porte différente.',
            es: 'Esta vez sudo te permite ejecutar find como root — sin necesidad del bit SUID. Mismo binario, mismo truco, puerta diferente.'
        },
        user: 'player',
        host: 'box-16',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recall the find -exec trick from GTFOBins', 'Spawn a root shell'],
            fr: ['Vérifier tes droits sudo', 'Te rappeler l\'astuce find -exec de GTFOBins', 'Ouvrir un shell root'],
            es: ['Comprobar tus permisos sudo', 'Recordar el truco find -exec de GTFOBins', 'Abrir un shell root']
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
            ],
            es: [
                'Prueba: sudo -l',
                'sudo find funciona igual que find con SUID — GTFOBins lo lista como binario capaz de abrir un shell en ambos casos.',
                'Payload: sudo find . -exec /bin/sh \\;'
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
            },
            es: {
                vuln: 'Mala configuración sudoers — NOPASSWD en find',
                why: 'Ya obtenga find su poder de un bit SUID o de una regla sudo, el resultado es idéntico: -exec le permite lanzar un programa arbitrario, que hereda los privilegios de root. El vector cambia, pero el consejo de GTFOBins es el mismo en ambos casos.',
                fix: 'Nunca des sudo sobre una herramienta de archivos genérica. Si find debe ejecutarse como root para una tarea concreta, envuélvelo en un script con argumentos fijos, sin -exec/-delete, y consulta GTFOBins antes de escribir cualquier regla sudoers.',
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
        title: { en: 'Box-17 · Environmentally Unfriendly', fr: 'Box-17 · Environnement hostile', es: 'Box-17 · Entorno hostil' },
        brief: {
            en: 'sudo lets you run env as root. env can launch any program you hand it — including a shell.',
            fr: 'sudo t\'autorise env en root. env peut lancer n\'importe quel programme qu\'on lui passe — y compris un shell.',
            es: 'sudo te permite ejecutar env como root. env puede lanzar cualquier programa que le pases — incluido un shell.'
        },
        user: 'player',
        host: 'box-17',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recognise env on GTFOBins', 'Use it to launch a root shell'],
            fr: ['Vérifier tes droits sudo', 'Reconnaître env sur GTFOBins', 'L\'utiliser pour lancer un shell root'],
            es: ['Comprobar tus permisos sudo', 'Reconocer env en GTFOBins', 'Usarlo para lanzar un shell root']
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
            ],
            es: [
                'Prueba: sudo -l',
                'env normalmente fija variables de entorno y luego ejecuta un comando. Dale un shell en su lugar. Consulta GTFOBins para "env".',
                'Payload: sudo env /bin/sh'
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
            },
            es: {
                vuln: 'Mala configuración sudoers — NOPASSWD en env',
                why: 'El trabajo de env es ejecutar un comando con un entorno modificado. sudo env /bin/sh se salta la modificación y simplemente ejecuta /bin/sh — como root, ya que esa es la identidad bajo la que sudo hizo correr env.',
                fix: 'Nunca des sudo sobre env, ni sobre ningún wrapper capaz de lanzar un programa arbitrario. Si un script realmente necesita env, invócalo directamente con un objetivo fijo en vez de exponer sudo sobre el binario bruto.',
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
        title: { en: 'Box-18 · The Interpreter\'s Gambit', fr: 'Box-18 · Le gambit de l\'interpréteur', es: 'Box-18 · El gambito del intérprete' },
        brief: {
            en: 'sudo lets you run python3 as root. Any interpreter that can shell out is a root shell in disguise.',
            fr: 'sudo t\'autorise python3 en root. Tout interpréteur capable d\'ouvrir un shell est un shell root déguisé.',
            es: 'sudo te permite ejecutar python3 como root. Cualquier intérprete capaz de abrir un shell es un shell root disfrazado.'
        },
        user: 'player',
        host: 'box-18',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Use python3\'s os.system to spawn a shell', 'Confirm root'],
            fr: ['Vérifier tes droits sudo', 'Utiliser os.system de python3 pour ouvrir un shell', 'Confirmer root'],
            es: ['Comprobar tus permisos sudo', 'Usar os.system de python3 para abrir un shell', 'Confirmar root']
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
            ],
            es: [
                'Prueba: sudo -l',
                'python3 -c ejecuta Python arbitrario. os.system() abre un shell. Consulta GTFOBins para "python".',
                'Payload: sudo python3 -c \'import os; os.system("/bin/sh")\''
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
            },
            es: {
                vuln: 'Mala configuración sudoers — NOPASSWD en python3',
                why: 'python3 -c ejecuta código arbitrario, y os.system() llama directamente al shell. sudo otorga a ese código privilegios de root, así que basta un one-liner para conseguir un shell root — el mismo patrón se aplica a perl, ruby y cualquier otro intérprete de scripts.',
                fix: 'Nunca des sudo sobre un intérprete genérico. Si un script Python debe ejecutarse como root, entrégalo como un script fijo y revisado — nunca como acceso sudo al propio intérprete.',
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
        title: { en: 'Box-19 · Pager, Interrupted', fr: 'Box-19 · Le pager interrompu', es: 'Box-19 · El paginador interrumpido' },
        brief: {
            en: 'sudo lets you run the less pager as root. Pagers let you shell out to run other commands mid-view.',
            fr: 'sudo t\'autorise le pager less en root. Les pagers laissent lancer d\'autres commandes en cours de lecture.',
            es: 'sudo te permite ejecutar el paginador less como root. Los paginadores permiten abrir un shell para ejecutar otros comandos en plena lectura.'
        },
        user: 'player',
        host: 'box-19',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recall the pager shell-escape trick', 'Spawn a root shell'],
            fr: ['Vérifier tes droits sudo', 'Te rappeler l\'astuce d\'échappement des pagers', 'Ouvrir un shell root'],
            es: ['Comprobar tus permisos sudo', 'Recordar el truco de escape de shell de los paginadores', 'Abrir un shell root']
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
            ],
            es: [
                'Prueba: sudo -l',
                'En una terminal real abrirías less, pulsarías "!" y escribirías /bin/sh para salir a un shell. Consulta GTFOBins para "less".',
                'Este simulador reproduce el escape directamente en una línea: sudo less !/bin/sh'
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
            },
            es: {
                vuln: 'Mala configuración sudoers — NOPASSWD en less',
                why: 'less (como more, man y la mayoría de paginadores) admite un escape de shell "!comando" para ejecutar un comando rápido sin salir del visor. Bajo sudo, ese comando escapado se ejecuta como root — un shell root instantáneo desde un programa cuyo único trabajo debería ser mostrar texto.',
                fix: 'Nunca des sudo sobre un paginador o visor. Si un usuario realmente necesita revisar logs propiedad de root, usa un wrapper restringido (o herramientas tipo sudoedit) en vez de acceso sudo directo a less/more/man.',
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
        title: { en: 'Box-20 · Tee\'d Off', fr: 'Box-20 · À bout de tee', es: 'Box-20 · Al límite del tee' },
        brief: {
            en: '/etc/passwd is locked down this time — but sudo lets you run tee as root, and tee writes wherever it is pointed.',
            fr: '/etc/passwd est verrouillé cette fois — mais sudo t\'autorise tee en root, et tee écrit là où on le pointe.',
            es: '/etc/passwd está bloqueado esta vez — pero sudo te permite ejecutar tee como root, y tee escribe donde se le apunte.'
        },
        user: 'player',
        host: 'box-20',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Pipe a rogue UID-0 line into tee -a', 'Switch to your new root account'],
            fr: ['Vérifier tes droits sudo', 'Envoyer une ligne UID 0 dans tee -a via un pipe', 'Basculer sur ton nouveau compte root'],
            es: ['Comprobar tus permisos sudo', 'Enviar una línea UID 0 a tee -a mediante un pipe', 'Cambiar a tu nueva cuenta root']
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
            ],
            es: [
                'Prueba: sudo -l — un simple "echo >> /etc/passwd" fallará, esta vez el archivo no es escribible.',
                'tee lee desde un pipe y escribe en cualquier archivo que se le indique — ejecutarlo bajo sudo hace que esa escritura ocurra como root.',
                'Payload: echo \'r00t::0:0::/root:/bin/bash\' | sudo tee -a /etc/passwd   luego   su r00t'
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
            },
            es: {
                vuln: 'Mala configuración sudoers — NOPASSWD en tee',
                why: 'tee no tiene intérprete que abusar ni flag de shell — simplemente copia stdin a un archivo. Ese es justo el problema: sudo tee puede sobrescribir o añadir contenido a *cualquier* archivo como root, incluido /etc/passwd. Una línea UID 0 enviada por pipe, con el campo de contraseña vacío, crea una cuenta de puerta trasera instantánea.',
                fix: 'Nunca des sudo sobre tee (ni cp, dd, o cat con redirección) sin restringir la ruta de destino. Si un script necesita actualizar legítimamente archivos propiedad de root, usa un wrapper específico que valide el destino en vez de una primitiva de escritura de archivos en bruto.',
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
        title: { en: 'Box-21 · Beyond Discretionary Access', fr: 'Box-21 · Au-delà du contrôle discrétionnaire', es: 'Box-21 · Más allá del control discrecional' },
        brief: {
            en: 'SUID audit is clean and sudo -l is empty. But capabilities strike again — this time one that skips read permission checks entirely.',
            fr: 'L\'audit SUID est propre et sudo -l est vide. Mais les capabilities frappent encore — cette fois une qui court-circuite entièrement les vérifications de lecture.',
            es: 'La auditoría SUID está limpia y sudo -l está vacío. Pero las capabilities golpean de nuevo — esta vez una que se salta por completo las comprobaciones de permiso de lectura.'
        },
        user: 'player',
        host: 'box-21',
        cwd: '/home/player',
        objectives: {
            en: ['List capabilities on the system', 'Read /etc/shadow despite its permissions', 'Crack the root hash', 'Log in as root'],
            fr: ['Lister les capabilities du système', 'Lire /etc/shadow malgré ses permissions', 'Casser le hash de root', 'Te connecter en root'],
            es: ['Listar las capabilities del sistema', 'Leer /etc/shadow a pesar de sus permisos', 'Crackear el hash de root', 'Iniciar sesión como root']
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
            ],
            es: [
                'Prueba: getcap -r / 2>/dev/null',
                'cap_dac_read_search salta el control de acceso discrecional (DAC) — las comprobaciones habituales de propietario/modo — para lecturas y recorrido de directorios. python3 la tiene.',
                'python3 -c "print(open(\'/etc/shadow\').read())" — luego crackea la copia que deja: john /tmp/shadow.copy, y después su root'
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
            hint: { en: 'setcap -r /usr/bin/python3', fr: 'setcap -r /usr/bin/python3', es: 'setcap -r /usr/bin/python3' }
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
            },
            es: {
                vuln: 'Capability Linux cap_dac_read_search+ep en python3',
                why: 'cap_dac_read_search otorga a un proceso la capacidad, a nivel de kernel, de saltarse las comprobaciones de permiso de *lectura* y recorrido de directorios — con independencia del propietario o el modo del archivo. Un simple open()/read() en python3 extrae /etc/shadow directamente, hash incluido, sin más exploit que llamar a open().',
                fix: 'Retira la capability con setcap -r /usr/bin/python3, y audita cap_dac_read_search / cap_dac_override en cualquier intérprete o herramienta de archivado (tar, python, perl) igual que auditarías el SUID. Rota cualquier credencial cuyo hash pueda haber quedado expuesto.',
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
        title: { en: 'Box-22 · The Missing Library', fr: 'Box-22 · La bibliothèque manquante', es: 'Box-22 · La biblioteca perdida' },
        brief: {
            en: 'sudo preserves LD_LIBRARY_PATH this time, not LD_PRELOAD. A root-run helper is missing one specific shared library — plant it yourself.',
            fr: 'Cette fois sudo préserve LD_LIBRARY_PATH, pas LD_PRELOAD. Un utilitaire lancé en root cherche une bibliothèque partagée précise — plante-la toi-même.',
            es: 'Esta vez sudo conserva LD_LIBRARY_PATH, no LD_PRELOAD. Una utilidad ejecutada como root busca una biblioteca compartida concreta — plántala tú mismo.'
        },
        user: 'player',
        host: 'box-22',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions and preserved variables', 'Find which library /usr/local/bin/backup-agent is missing', 'Plant a malicious copy under a writable LD_LIBRARY_PATH', 'Trigger it via sudo'],
            fr: ['Vérifier tes droits sudo et les variables préservées', 'Trouver quelle bibliothèque il manque à /usr/local/bin/backup-agent', 'Planter une copie malveillante sous un LD_LIBRARY_PATH modifiable', 'La déclencher via sudo'],
            es: ['Comprobar tus permisos sudo y las variables conservadas', 'Averiguar qué biblioteca le falta a /usr/local/bin/backup-agent', 'Plantar una copia maliciosa bajo un LD_LIBRARY_PATH escribible', 'Dispararla vía sudo']
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
            ],
            es: [
                'Prueba: sudo -l — mira bien env_keep.',
                'LD_LIBRARY_PATH añade un directorio de búsqueda para bibliotecas compartidas. A diferencia de LD_PRELOAD, el archivo cargado debe llamarse exactamente como lo busca el programa objetivo: libagent.so.1 (mira /usr/local/bin/README.txt).',
                'Payload: echo \'void _init(){setuid(0);system("/bin/sh");}\' > /tmp/libagent.so.1.c ; gcc -shared -fPIC -nostartfiles -o /tmp/libagent.so.1 /tmp/libagent.so.1.c ; sudo LD_LIBRARY_PATH=/tmp /usr/local/bin/backup-agent'
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
            },
            es: {
                vuln: 'sudo env_keep expone LD_LIBRARY_PATH',
                why: 'LD_LIBRARY_PATH indica al enlazador dinámico lugares adicionales donde buscar bibliotecas compartidas antes que las rutas por defecto del sistema. backup-agent se distribuyó dependiendo de libagent.so.1 sin un rpath absoluto, así que el directorio al que apunte LD_LIBRARY_PATH se busca primero. sudo normalmente limpia el entorno, pero la línea Defaults de esta box conserva explícitamente LD_LIBRARY_PATH — así que un .so malicioso con el mismo nombre, colocado donde apunte sudo LD_LIBRARY_PATH, se carga como root en cuanto el agente se ejecuta.',
                fix: 'Nunca añadas LD_PRELOAD o LD_LIBRARY_PATH a env_keep. Distribuye las dependencias con un paquete adecuado o con un RPATH/RUNPATH absoluto incrustado en el binario, en vez de depender de una ruta de búsqueda en tiempo de ejecución.',
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
        title: { en: 'Box-23 · Trust the Client', fr: 'Box-23 · Faire confiance au client', es: 'Box-23 · Confiar en el cliente' },
        brief: {
            en: "/srv/backups is locked down (root-owned, mode 750) — but it's also exported over NFS with no_root_squash. Mount it and the export's own rules, not the directory's, decide what you can do.",
            fr: "/srv/backups est verrouillé (root, mode 750) — mais il est aussi exporté en NFS avec no_root_squash. Monte-le : ce sont les règles de l'export, pas celles du dossier, qui décident de ce que tu peux faire.",
            es: '/srv/backups está bloqueado (propiedad de root, modo 750) — pero también se exporta por NFS con no_root_squash. Móntalo: son las reglas del export, no las del directorio, las que deciden lo que puedes hacer.'
        },
        user: 'player',
        host: 'box-23',
        cwd: '/home/player',
        objectives: {
            en: ['List the NFS exports this host offers', 'Mount the writable one', 'Plant a root-owned setuid shell through the mount', 'Run it for a root shell'],
            fr: ['Lister les partages NFS de cet hôte', 'Monter celui qui est modifiable', 'Planter un shell setuid appartenant à root via le montage', "L'exécuter pour obtenir un shell root"],
            es: ['Listar los exports NFS que ofrece este host', 'Montar el que es escribible', 'Plantar un shell setuid propiedad de root a través del montaje', 'Ejecutarlo para obtener un shell root']
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
            ],
            es: [
                'Prueba: showmount -e — luego cat /etc/exports para leer las opciones.',
                'no_root_squash significa que el UID root del cliente que monta se trata como root real en ese export, sin importar el propietario/modo del directorio en el servidor. Una vez montado, /srv/backups en sí se vuelve escribible para ti.',
                'Móntalo, planta un shell setuid, ejecútalo:\n  mount -t nfs box-23:/srv/backups /mnt\n  touch /srv/backups/rootbash\n  chmod u+s /srv/backups/rootbash\n  /srv/backups/rootbash'
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
            },
            es: {
                vuln: 'Export NFS con no_root_squash',
                why: '/srv/backups resiste los permisos Unix habituales desde el shell local (modo 750, propiedad de root) — pero /etc/exports lo comparte con rw y no_root_squash. Esa opción es toda la vulnerabilidad: normalmente NFS "aplasta" el root (UID 0) de un cliente que monta hasta convertirlo en un usuario nobody sin privilegios, pero no_root_squash desactiva eso, así que el root del cliente se trata como el root real del servidor para cualquier operación dentro del export. Montarlo localmente y crear ahí un shell setuid root basta — son los permisos del export, no los del directorio, los que rigen la escritura, y el binario resultante es propiedad real de root.',
                fix: 'Nunca exportes comparticiones escribibles con no_root_squash a clientes no confiables. Usa root_squash (o all_squash) por defecto, y restringe los exports a hosts de confianza concretos en vez de *.',
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
        title: { en: 'Box-24 · One-Liner', fr: 'Box-24 · Le one-liner', es: 'Box-24 · El one-liner' },
        brief: {
            en: 'sudo lets you run perl as root. perl -e can execute an arbitrary system command from a single expression.',
            fr: "sudo t'autorise perl en root. perl -e peut exécuter n'importe quelle commande système depuis une seule expression.",
            es: 'sudo te permite ejecutar perl como root. perl -e puede ejecutar cualquier comando del sistema desde una sola expresión.'
        },
        user: 'player',
        host: 'box-24',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recognise perl on GTFOBins', 'Use it to launch a root shell'],
            fr: ['Vérifier tes droits sudo', 'Reconnaître perl sur GTFOBins', 'L\'utiliser pour lancer un shell root'],
            es: ['Comprobar tus permisos sudo', 'Reconocer perl en GTFOBins', 'Usarlo para lanzar un shell root']
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
            ],
            es: [
                'Prueba: sudo -l',
                'perl -e ejecuta un script en línea. Busca "perl" en GTFOBins para el one-liner de sudo.',
                'Payload: sudo perl -e \'exec "/bin/sh";\''
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
            },
            es: {
                vuln: 'Mala configuración sudoers — NOPASSWD en perl',
                why: 'perl -e ejecuta una expresión Perl en línea. exec reemplaza el proceso actual por /bin/sh — y como sudo ya había elevado perl a root, el shell resultante hereda esa identidad root.',
                fix: 'Nunca des sudo sobre un intérprete de scripts genérico (perl, python, ruby...). Si un script necesita perl, invoca una ruta de script concreta y no editable en vez de exponer el binario bruto.',
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
        title: { en: 'Box-25 · Node Break', fr: 'Box-25 · Node casse tout', es: 'Box-25 · Node lo rompe todo' },
        brief: {
            en: "sudo lets you run node as root. Node's child_process module can spawn an interactive shell from a one-off script.",
            fr: "sudo t'autorise node en root. Le module child_process de Node peut lancer un shell interactif depuis un script jetable.",
            es: 'sudo te permite ejecutar node como root. El módulo child_process de Node puede lanzar un shell interactivo desde un script de usar y tirar.'
        },
        user: 'player',
        host: 'box-25',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recognise node on GTFOBins', 'Spawn a root shell via child_process'],
            fr: ['Vérifier tes droits sudo', 'Reconnaître node sur GTFOBins', 'Lancer un shell root via child_process'],
            es: ['Comprobar tus permisos sudo', 'Reconocer node en GTFOBins', 'Lanzar un shell root vía child_process']
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
            ],
            es: [
                'Prueba: sudo -l',
                'node -e ejecuta un script en línea, la misma idea que python3 -c. Consulta GTFOBins para "node" — el truco de require(\'child_process\').',
                'Payload: sudo node -e \'require("child_process").spawn("/bin/sh", {stdio: [0, 1, 2]})\''
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
            },
            es: {
                vuln: 'Mala configuración sudoers — NOPASSWD en node',
                why: 'node -e ejecuta un fragmento de JS en línea con los privilegios propios del proceso. require(\'child_process\').spawn() lanza /bin/sh como hijo de ese proceso — heredando root, ya que sudo había elevado node a root antes de que el script se ejecutara.',
                fix: 'Nunca des sudo sobre un runtime genérico (node, python, perl...). Envuelve la tarea legítima en un script fijo y no editable, y concede sudo sobre esa ruta de script en su lugar.',
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
        title: { en: 'Box-26 · The Editor\'s Trust', fr: "Box-26 · La confiance de l'éditeur", es: 'Box-26 · La confianza del editor' },
        brief: {
            en: "sudoedit lets you edit /etc/motd as root without ever running /etc/motd itself. But it does that by forking your own $EDITOR — and sudoers kept EDITOR set.",
            fr: "sudoedit te permet d'éditer /etc/motd en root sans jamais exécuter /etc/motd lui-même. Mais pour ça, il lance ton propre $EDITOR — et sudoers a conservé la variable EDITOR.",
            es: 'sudoedit te permite editar /etc/motd como root sin ejecutar nunca /etc/motd en sí. Pero para eso lanza tu propio $EDITOR — y sudoers mantuvo EDITOR definida.'
        },
        user: 'player',
        host: 'box-26',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Notice EDITOR is kept across sudo', 'Point EDITOR at your own script before running sudoedit'],
            fr: ["Vérifier tes droits sudo", "Remarquer qu'EDITOR est conservée à travers sudo", "Pointer EDITOR vers ton propre script avant de lancer sudoedit"],
            es: ['Comprobar tus permisos sudo', 'Darte cuenta de que EDITOR se conserva a través de sudo', 'Apuntar EDITOR a tu propio script antes de ejecutar sudoedit']
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
            ],
            es: [
                'Prueba: sudo -l — mira la línea env_keep, no solo la lista de comandos.',
                'sudoedit nunca ejecuta el archivo objetivo como root — ejecuta $EDITOR sobre una copia temporal de él, como root.',
                'Escribe un script de shell de una línea, hazlo ejecutable con chmod +x, y luego: sudo EDITOR=/ruta/script -e /etc/motd'
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
            },
            es: {
                vuln: 'sudoedit / sudo -e con EDITOR conservada en env_keep',
                why: 'sudoedit está diseñado para ser más seguro que "sudo vim archivo" — nunca ejecuta el archivo objetivo con privilegios elevados. En su lugar lo copia a un lugar escribible y abre *tu* $EDITOR sobre esa copia, como root, y luego copia el resultado de vuelta. Si sudoers mantuvo EDITOR en env_keep, ese editor puede ser cualquier ejecutable que elijas — un script de una línea que simplemente ejecute un shell basta.',
                fix: 'Nunca mantengas EDITOR/VISUAL en env_keep para una regla sudoedit — eso reintroduce exactamente el riesgo que sudoedit existe para evitar. Si se necesita un editor fijo, codifícalo directamente en la regla sudoers (p. ej. vía un wrapper sin env_keep) en vez de confiar en el entorno de quien invoca.',
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
        title: { en: 'Box-27 · Override', fr: 'Box-27 · Outrepasser', es: 'Box-27 · Sobrepasar' },
        brief: {
            en: '/etc/passwd is locked down and there\'s no sudo here. But python3 was granted cap_dac_override — the capability that bypasses discretionary write checks entirely, not just reads.',
            fr: "/etc/passwd est verrouillé et il n'y a pas de sudo ici. Mais python3 a reçu cap_dac_override — la capability qui contourne totalement les vérifications d'écriture, pas seulement la lecture.",
            es: '/etc/passwd está bloqueado y aquí no hay sudo. Pero python3 recibió cap_dac_override — la capability que se salta por completo las comprobaciones de escritura discrecionales, no solo las de lectura.'
        },
        user: 'player',
        host: 'box-27',
        cwd: '/home/player',
        objectives: {
            en: ['Find the capability with getcap', 'Understand why this one is worse than a read-only bypass', 'Append a UID-0 backdoor line to /etc/passwd', 'su into it'],
            fr: ["Trouver la capability avec getcap", "Comprendre pourquoi celle-ci est pire qu'un simple contournement de lecture", "Ajouter une ligne backdoor UID 0 à /etc/passwd", "Basculer dessus avec su"],
            es: ['Encontrar la capability con getcap', 'Entender por qué esta es peor que un simple bypass de lectura', 'Añadir una línea de puerta trasera UID 0 a /etc/passwd', 'Hacer su a esa cuenta']
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
            ],
            es: [
                'Prueba: getcap -r / 2>/dev/null',
                'cap_dac_override salta el control de acceso discrecional tanto en lectura COMO en escritura — cap_dac_read_search (vista en otra box) solo cubre lecturas.',
                'python3 -c "open(\'/etc/passwd\',\'a\').write(\'pwnd::0:0::/root:/bin/bash\\n\')" luego: su pwnd'
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
            obj: { en: 'Strip the cap_dac_override capability from python3', fr: 'Retire la capability cap_dac_override de python3', es: 'Retira la capability cap_dac_override de python3' },
            hint: { en: 'setcap -r /usr/bin/python3', fr: 'setcap -r /usr/bin/python3', es: 'setcap -r /usr/bin/python3' }
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
            },
            es: {
                vuln: 'Capability Linux cap_dac_override+ep en python3',
                why: 'cap_dac_read_search (vista en otras box) solo se salta las comprobaciones de lectura y recorrido de directorios — nunca permite escribir. cap_dac_override es la capability estrictamente mayor: se salta el control de acceso discrecional tanto en lectura como en escritura. Un simple open(ruta, \'a\').write(...) en python3 añade directamente a /etc/passwd — propiedad de root, modo 644 — aunque el jugador no tenga ningún permiso de escritura sobre él. Añadir una línea UID 0 con el campo de contraseña vacío crea una cuenta root instantánea y sin contraseña.',
                fix: 'Retira las capabilities innecesarias con setcap -r /usr/bin/python3, y trata cap_dac_override en cualquier intérprete o herramienta de manejo de archivos como root completo — es, a efectos del sistema de archivos, indistinguible de serlo. Audita regularmente con getcap -r /, y nunca concedas DAC_OVERRIDE a un intérprete genérico.',
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
        title: { en: 'Box-28 · Minus One', fr: 'Box-28 · Moins un', es: 'Box-28 · Menos uno' },
        brief: {
            en: "sudo -l says you can run /bin/bash as anyone except root. Sounds safe — except old sudo has a bug about how \"except root\" actually gets checked.",
            fr: "sudo -l dit que tu peux lancer /bin/bash en tant que n'importe qui sauf root. Ça semble sûr — sauf que les vieilles versions de sudo ont un bug dans la façon dont \"sauf root\" est vraiment vérifié.",
            es: 'sudo -l dice que puedes ejecutar /bin/bash como cualquiera excepto root. Suena seguro — salvo que las versiones antiguas de sudo tienen un fallo en cómo se comprueba realmente ese "excepto root".'
        },
        user: 'player',
        host: 'box-28',
        cwd: '/home/player',
        objectives: {
            en: ['Check sudo -l and read the exclusion carefully', 'Confirm -u root is really blocked', 'Find the uid that bypasses a name-only exclusion', 'Get a root shell'],
            fr: ["Vérifier sudo -l et bien lire l'exclusion", 'Confirmer que -u root est vraiment bloqué', "Trouver l'uid qui contourne une exclusion basée uniquement sur le nom", 'Obtenir un shell root'],
            es: ['Comprobar sudo -l y leer bien la exclusión', 'Confirmar que -u root está realmente bloqueado', 'Encontrar el uid que evita una exclusión basada solo en el nombre', 'Obtener un shell root']
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
            ],
            es: [
                'sudo -l — lee bien la parte "(ALL, !root)". Excluye a un usuario por su nombre.',
                'sudo -u root /bin/bash sigue siendo rechazado — la exclusión sí detecta el nombre literal.',
                'Esto es el CVE-2019-14287: prueba sudo -u#-1 /bin/bash (o el desbordamiento uint32, sudo -u#4294967295 /bin/bash).'
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
            },
            es: {
                vuln: 'Exclusión "runas" sudo "(ALL, !root)" — CVE-2019-14287',
                why: 'La regla sudoers parece segura: ejecutar /bin/bash como cualquier usuario, pero nunca como root. Y sudo -u root realmente se rechaza. El fallo está en cómo las versiones anteriores a 1.8.28 resuelven un objetivo numérico: -u#-1 (o su desbordamiento en entero de 32 bits sin signo, -u#4294967295) nunca se compara con la cadena literal "root" durante la comprobación de la política, así que la exclusión nunca se dispara — pero la llamada setresuid() resultante sigue llegando al uid 0, porque -1 convertido a uid_t es 0. La lista de bloqueo basada en el nombre y el privilegio real que otorga el kernel son dos cosas distintas, y este fallo vivía exactamente en esa brecha.',
                fix: 'Actualiza a sudo >= 1.8.28, donde los uid negativos o desbordados se rechazan directamente. Estructuralmente, prefiere una lista blanca explícita de usuarios runas antes que una exclusión tipo "ALL excepto" — una lista positiva no deja nada por lo que un truco de uid pueda colarse. Audita con sudo -l y trata cualquier patrón de exclusión "!usuario" como una señal de alerta que merece comprobar la versión.',
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
        title: { en: 'Box-29 · Run As A Service', fr: 'Box-29 · Lancé comme un service', es: 'Box-29 · Ejecutado como un servicio' },
        brief: {
            en: 'sudo -l grants systemd-run, nothing else. It looks harmless — it just launches services. But services are managed by a process that runs as root.',
            fr: "sudo -l n'accorde que systemd-run, rien d'autre. Ça semble inoffensif — ça ne fait que lancer des services. Mais les services sont gérés par un processus qui tourne en root.",
            es: 'sudo -l solo concede systemd-run, nada más. Parece inofensivo — solo lanza servicios. Pero los servicios los gestiona un proceso que se ejecuta como root.'
        },
        user: 'player',
        host: 'box-29',
        cwd: '/home/player',
        objectives: {
            en: ['Check sudo -l', 'Understand who actually runs a systemd unit', 'Launch a transient shell unit as root'],
            fr: ['Vérifier sudo -l', 'Comprendre qui exécute réellement une unité systemd', 'Lancer une unité transitoire shell en root'],
            es: ['Comprobar sudo -l', 'Entender quién ejecuta realmente una unidad systemd', 'Lanzar una unidad transitoria de shell como root']
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
            ],
            es: [
                'sudo -l — systemd-run está permitido. Consulta GTFOBins para "systemd-run".',
                'systemd-run habla con el gestor del sistema (PID 1) para programar una unidad transitoria — ese gestor se ejecuta como root, no con tus permisos.',
                'sudo systemd-run /bin/sh — el comando de la unidad se ejecuta como root sin importar quién invocó systemd-run.'
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
            },
            es: {
                vuln: 'NOPASSWD sudoers en systemd-run (GTFOBins)',
                why: 'systemd-run no ejecuta tu comando directamente — entrega una descripción de trabajo al gestor del sistema (PID 1) vía D-Bus, y ese gestor la programa y la ejecuta. sudo solo deja pasar a systemd-run en sí; el gestor con el que habla ya se ejecuta como root, así que la unidad transitoria que programa también se ejecuta como root, independientemente de quién llamó a systemd-run. Cualquier binario que finalmente delega la ejecución a un demonio privilegiado tiene el mismo tipo de riesgo que un shell root directo.',
                fix: 'Nunca concedas systemd-run (ni ningún cliente de un gestor de servicios) vía sudo salvo que el objetivo sea totalmente de confianza con root — no existe un subconjunto restringido seguro de esto. Prefiere permisos delimitados por polkit, específicos de una unidad (systemctl start/stop sobre una unidad concreta) en vez de una concesión genérica de systemd-run, y consulta GTFOBins antes de escribir cualquier regla sudoers nueva.',
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
        title: { en: 'Box-30 · Update Hook', fr: 'Box-30 · Le hook de mise à jour', es: 'Box-30 · El hook de actualización' },
        brief: {
            en: 'sudo -l grants apt-get, nothing else — a package manager, not an interpreter. But apt-get lets you override its config from the command line, including which commands it runs before an update.',
            fr: "sudo -l n'accorde qu'apt-get, rien d'autre — un gestionnaire de paquets, pas un interpréteur. Mais apt-get permet de surcharger sa config en ligne de commande, y compris quelles commandes il exécute avant une mise à jour.",
            es: 'sudo -l solo concede apt-get, nada más — un gestor de paquetes, no un intérprete. Pero apt-get permite sobrescribir su configuración desde la línea de comandos, incluyendo qué comandos ejecuta antes de una actualización.'
        },
        user: 'player',
        host: 'box-30',
        cwd: '/home/player',
        objectives: {
            en: ['Check sudo -l', 'Look up apt-get on GTFOBins', 'Override the Pre-Invoke hook to run a shell'],
            fr: ['Vérifier sudo -l', 'Chercher apt-get sur GTFOBins', 'Surcharger le hook Pre-Invoke pour lancer un shell'],
            es: ['Comprobar sudo -l', 'Buscar apt-get en GTFOBins', 'Sobrescribir el hook Pre-Invoke para lanzar un shell']
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
            ],
            es: [
                'sudo -l — apt-get está permitido. Consulta GTFOBins para "apt-get" o "apt".',
                'apt-get -o permite fijar cualquier clave de configuración solo para esta ejecución, incluidos los comandos de hook normalmente definidos en /etc/apt/apt.conf.',
                'sudo apt-get update -o APT::Update::Pre-Invoke::=/bin/sh — el hook se ejecuta antes que cualquier otra cosa de apt-get, como root.'
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
            },
            es: {
                vuln: 'NOPASSWD sudoers en apt-get (hook de sobrescritura de config, GTFOBins)',
                why: 'apt-get no es un shell ni un intérprete, así que una concesión NOPASSWD sobre él parece conservadora. Pero apt-get -o permite al invocador fijar cualquier clave de configuración para esa ejecución, incluidos los hooks *Pre-Invoke normalmente reservados a /etc/apt/apt.conf. APT::Update::Pre-Invoke ejecuta su valor como un comando de shell antes de que la actualización haga nada — y como apt-get se ejecuta como root bajo sudo, también lo hace el hook. El gestor de paquetes nunca fue el riesgo; su superficie de configuración sin restricciones sí lo era.',
                fix: 'Nunca concedas un gestor de paquetes vía sudo sin restringir los argumentos (sudoers admite reglas por argumento, p. ej. limitar a `apt-get update` sin permitir `-o`/`-c`) — un NOPASSWD desnudo sobre la ruta del binario entrega todos los flags que soporta, incluidas las sobrescrituras de configuración. Consulta GTFOBins antes de escribir cualquier regla sudoers para una herramienta que no hayas auditado por este tipo de escape de "inyección de configuración".',
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
        title: { en: 'Box-31 · Query Escape', fr: 'Box-31 · Échappement de requête', es: 'Box-31 · Escape de consulta' },
        brief: {
            en: "sudo -l grants mysql, nothing else — a database client. It just runs queries... except its interactive shell has a builtin escape command that has nothing to do with SQL.",
            fr: "sudo -l n'accorde que mysql, rien d'autre — un client de base de données. Il ne fait qu'exécuter des requêtes... sauf que son shell interactif a une commande d'échappement intégrée qui n'a rien à voir avec le SQL.",
            es: 'sudo -l solo concede mysql, nada más — un cliente de base de datos. Solo ejecuta consultas... salvo que su shell interactivo tiene un comando de escape incorporado que no tiene nada que ver con SQL.'
        },
        user: 'player',
        host: 'box-31',
        cwd: '/home/player',
        objectives: {
            en: ['Check sudo -l', 'Look up mysql on GTFOBins', 'Use the client\'s shell-escape builtin to get root'],
            fr: ['Vérifier sudo -l', 'Chercher mysql sur GTFOBins', "Utiliser la commande d'échappement du client pour obtenir root"],
            es: ['Comprobar sudo -l', 'Buscar mysql en GTFOBins', 'Usar el comando de escape del cliente para obtener root']
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
            ],
            es: [
                'sudo -l — mysql está permitido. Consulta GTFOBins para "mysql".',
                'El CLI de mysql tiene comandos incorporados que empiezan por \\ — uno de ellos ejecuta un comando de shell arbitrario.',
                'sudo mysql -e \'\\! /bin/sh\' — el escape \\! se ejecuta fuera del motor SQL, con los permisos de quien esté ejecutando mysql.'
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
            },
            es: {
                vuln: 'NOPASSWD sudoers en mysql (escape de shell incorporado del cliente, GTFOBins)',
                why: 'Un cliente de base de datos parece razonablemente lejos de un shell — su único trabajo es ejecutar SQL. Pero el modo interactivo del CLI de mysql tiene su propio lenguaje de comandos por encima del SQL, prefijado con \\, y \\! está definido como "ejecutar un comando de shell". Se creó como una comodidad para administradores que alternan entre SQL y shell a mitad de sesión, no como una frontera de privilegios — así que cuando el propio mysql se ejecuta como root bajo sudo, \\! te entrega un shell root sin ningún SQL de por medio.',
                fix: 'Nunca concedas un cliente de base de datos interactivo vía sudo salvo que el objetivo sea de confianza con el shell sobre el que se apoya — no hay forma de permitir "solo consultas" una vez que los propios comandos de escape del cliente entran en juego. Cuando la automatización realmente solo necesita ejecutar consultas fijas, invoca mysql de forma no interactiva con un script bloqueado, sin exponer -e/--execute a una entrada arbitraria, y consulta GTFOBins antes de reglas sudoers para cualquier cliente con un REPL.',
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
        title: { en: 'Box-32 · Checkpoint Reached', fr: 'Box-32 · Point de contrôle atteint', es: 'Box-32 · Punto de control alcanzado' },
        brief: {
            en: "sudo -l grants tar, nothing else — an archiver. It just reads and writes files... except it has a progress-reporting feature that runs a command of your choice along the way.",
            fr: "sudo -l n'accorde que tar, rien d'autre — un archiveur. Il ne fait que lire et écrire des fichiers... sauf qu'il a une fonctionnalité de suivi de progression qui exécute une commande de ton choix en chemin.",
            es: 'sudo -l solo concede tar, nada más — un archivador. Solo lee y escribe archivos... salvo que tiene una función de reporte de progreso que ejecuta un comando de tu elección por el camino.'
        },
        user: 'player',
        host: 'box-32',
        cwd: '/home/player',
        objectives: {
            en: ['Check sudo -l', 'Look up tar on GTFOBins', 'Use a checkpoint action to run a shell as root'],
            fr: ['Vérifier sudo -l', 'Chercher tar sur GTFOBins', 'Utiliser une action de checkpoint pour lancer un shell en root'],
            es: ['Comprobar sudo -l', 'Buscar tar en GTFOBins', 'Usar una acción de checkpoint para lanzar un shell como root']
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
            ],
            es: [
                'sudo -l — tar está permitido. Consulta GTFOBins para "tar".',
                'tar --checkpoint=N reporta el progreso cada N registros; --checkpoint-action permite definir qué significa "reportar".',
                'sudo tar cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/sh — la acción se ejecuta con los permisos de quien esté ejecutando tar.'
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
            },
            es: {
                vuln: 'NOPASSWD sudoers en tar (hook checkpoint-action, GTFOBins)',
                why: "tar lee y escribe archivos comprimidos — no es un intérprete, así que una concesión NOPASSWD sobre él parece conservadora. Pero el flag --checkpoint-action de tar se creó para que los trabajos de archivado largos pudieran reportar progreso vía un comando externo arbitrario, y 'exec' es una de las acciones documentadas. Se ejecuta en cada checkpoint que tar alcanza por sí mismo — sin necesidad de ninguna entrada especial más allá del flag — y como el propio tar es root bajo sudo, esa acción también lo es. El archivado nunca fue el riesgo; el hook de reporte de progreso añadido a él sí lo era.",
                fix: 'Nunca concedas tar vía sudo sin restringir los argumentos — sudoers puede fijar los flags permitidos (p. ej. solo un comando de backup fijo sin opciones controladas por el usuario), ya que un NOPASSWD desnudo sobre el binario entrega todos los flags que soporta, incluido --checkpoint-action. Consulta GTFOBins antes de escribir reglas sudoers para cualquier herramienta con un mecanismo de plugin, hook o callback, archivadores incluidos.',
                link: 'https://gtfobins.github.io/gtfobins/tar/'
            }
        }
    },
    // ─────────────────────────────────────────────────────────────
    // LEVEL 33 — sudo git -p (GTFOBins: forced pager inherits root)
    // ─────────────────────────────────────────────────────────────
    {
        id: 33,
        codename: 'box-33',
        title: { en: 'Box-33 · Paged Out', fr: 'Box-33 · Paginé', es: 'Box-33 · Paginado' },
        brief: {
            en: "sudo -l grants git, nothing else — a version control tool. It just shows diffs and logs... through a pager it launches as a child process.",
            fr: "sudo -l n'accorde que git, rien d'autre — un outil de contrôle de version. Il ne fait qu'afficher des diffs et des logs... via un pager qu'il lance comme processus enfant.",
            es: 'sudo -l solo concede git, nada más — una herramienta de control de versiones. Solo muestra diffs y logs... a través de un paginador que lanza como proceso hijo.'
        },
        user: 'player',
        host: 'box-33',
        cwd: '/home/player',
        objectives: {
            en: ['Check sudo -l', 'Look up git on GTFOBins', 'Force a pager and escape it to a root shell'],
            fr: ['Vérifier sudo -l', 'Chercher git sur GTFOBins', 'Forcer un pager et s\'en échapper vers un shell root'],
            es: ['Comprobar sudo -l', 'Buscar git en GTFOBins', 'Forzar un paginador y escapar de él a un shell root']
        },
        hints: {
            en: [
                'sudo -l — git is allowed. Check GTFOBins for "git".',
                'git -p forces output through a pager (usually less) even for short output.',
                'sudo git -p help !/bin/sh — the pager is a child of git, which is root under sudo, so the pager\'s shell escape is root too.'
            ],
            fr: [
                'sudo -l — git est autorisé. Regarde GTFOBins pour "git".',
                'git -p force la sortie à passer par un pager (généralement less), même pour une sortie courte.',
                "sudo git -p help !/bin/sh — le pager est un enfant de git, qui est root sous sudo, donc l'échappement shell du pager l'est aussi."
            ],
            es: [
                'sudo -l — git está permitido. Consulta GTFOBins para "git".',
                'git -p fuerza la salida a pasar por un paginador (normalmente less), incluso para salidas cortas.',
                'sudo git -p help !/bin/sh — el paginador es un hijo de git, que es root bajo sudo, así que el escape de shell del paginador también lo es.'
            ]
        },
        flag: 'flag{git_pager_escape_pwn}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{git_pager_escape_pwn}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'git'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/git': ELF_BIN(),
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': ELF_BIN()
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/git', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers NOPASSWD on git (GTFOBins forced-pager escape)',
                why: "git looks safe to grant via sudo — it manages repositories, it doesn't run arbitrary code by name. But almost any git subcommand can be forced through a pager with -p, and by default that pager is less, which has its own shell-escape builtin (the same one box-19 exploits directly). The pager is spawned as a child process of git, inheriting whatever privilege git is running with — so once git is root under sudo, the pager it launches is root too, and the shell it escapes to is root by extension. The vulnerability was never in git's own code; it was in the trusted child process git hands control to.",
                fix: "Never grant a tool with an external pager/editor dependency via sudo without also locking down that dependency — GIT_PAGER=cat or --no-pager doesn't close the hole if -p can override it. Prefer restricting sudoers to the specific read-only subcommands actually needed (e.g. only `git log`, no `-p`), and check GTFOBins before writing sudoers rules for any tool that shells out to a pager, editor, or other helper program.",
                link: 'https://gtfobins.github.io/gtfobins/git/'
            },
            fr: {
                vuln: "NOPASSWD sudoers sur git (échappement par pager forcé, GTFOBins)",
                why: "git semble sûr à accorder via sudo — il gère des dépôts, il n'exécute pas de code arbitraire par son nom. Mais presque toute sous-commande git peut être forcée à passer par un pager avec -p, et par défaut ce pager est less, qui a son propre échappement shell intégré (le même que box-19 exploite directement). Le pager est lancé comme processus enfant de git, héritant du privilège avec lequel git tourne — donc une fois git root sous sudo, le pager qu'il lance l'est aussi, et le shell vers lequel il s'échappe l'est par extension. La faille n'a jamais été dans le code de git lui-même ; elle était dans le processus enfant de confiance auquel git délègue le contrôle.",
                fix: "N'accorde jamais un outil ayant une dépendance externe (pager, éditeur) via sudo sans verrouiller aussi cette dépendance — GIT_PAGER=cat ou --no-pager ne ferme pas la faille si -p peut le surcharger. Préfère restreindre sudoers aux sous-commandes en lecture seule réellement nécessaires (par exemple seulement `git log`, sans -p), et vérifie GTFOBins avant d'écrire des règles sudoers pour tout outil qui délègue à un pager, un éditeur ou un autre programme auxiliaire.",
                link: 'https://gtfobins.github.io/gtfobins/git/'
            },
            es: {
                vuln: 'NOPASSWD sudoers en git (escape por paginador forzado, GTFOBins)',
                why: 'git parece seguro de conceder vía sudo — gestiona repositorios, no ejecuta código arbitrario por su nombre. Pero casi cualquier subcomando de git puede forzarse a pasar por un paginador con -p, y por defecto ese paginador es less, que tiene su propio escape de shell incorporado (el mismo que explota directamente box-19). El paginador se lanza como proceso hijo de git, heredando el privilegio con el que se ejecuta git — así que una vez que git es root bajo sudo, el paginador que lanza también lo es, y el shell al que escapa lo es por extensión. La vulnerabilidad nunca estuvo en el propio código de git; estaba en el proceso hijo de confianza al que git cede el control.',
                fix: 'Nunca concedas una herramienta con una dependencia externa de paginador/editor vía sudo sin también bloquear esa dependencia — GIT_PAGER=cat o --no-pager no cierra el agujero si -p puede sobrescribirlo. Prefiere restringir sudoers a los subcomandos de solo lectura realmente necesarios (p. ej. solo `git log`, sin -p), y consulta GTFOBins antes de escribir reglas sudoers para cualquier herramienta que delegue en un paginador, editor u otro programa auxiliar.',
                link: 'https://gtfobins.github.io/gtfobins/git/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 34 — sudo NOPASSWD on nice (GTFOBins)
    // ─────────────────────────────────────────────────────────────
    {
        id: 34,
        codename: 'box-34',
        title: { en: 'Box-34 · Nice Try', fr: 'Box-34 · Belle tentative', es: 'Box-34 · Bonito intento' },
        brief: {
            en: "sudo -l grants nice, nothing else — a scheduling-priority tool. It just decides how much CPU time a program gets... then runs that program for you.",
            fr: "sudo -l n'accorde que nice, rien d'autre — un outil de priorité d'ordonnancement. Il décide juste combien de temps CPU un programme reçoit... puis lance ce programme pour toi.",
            es: 'sudo -l solo concede nice, nada más — una herramienta de prioridad de planificación. Solo decide cuánto tiempo de CPU recibe un programa... y luego ejecuta ese programa por ti.'
        },
        user: 'player',
        host: 'box-34',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recognise nice on GTFOBins', 'Use it to launch a root shell'],
            fr: ['Vérifier tes droits sudo', 'Reconnaître nice sur GTFOBins', 'L\'utiliser pour lancer un shell root'],
            es: ['Comprobar tus permisos sudo', 'Reconocer nice en GTFOBins', 'Usarlo para lanzar un shell root']
        },
        hints: {
            en: [
                'Try: sudo -l',
                'nice only adjusts scheduling priority — then it still has to run the command you gave it. Check GTFOBins for "nice".',
                'Payload: sudo nice /bin/sh'
            ],
            fr: [
                'Essaie : sudo -l',
                'nice ne fait qu\'ajuster la priorité d\'ordonnancement — il doit quand même lancer la commande que tu lui donnes. Regarde GTFOBins pour "nice".',
                'Payload : sudo nice /bin/sh'
            ],
            es: [
                'Prueba: sudo -l',
                'nice solo ajusta la prioridad de planificación — luego igualmente tiene que ejecutar el comando que le diste. Consulta GTFOBins para "nice".',
                'Payload: sudo nice /bin/sh'
            ]
        },
        flag: 'flag{n1ce_pr10rity_r00t}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{n1ce_pr10rity_r00t}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'nice'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/nice': ELF_BIN(),
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': ELF_BIN()
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/nice', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers misconfiguration — NOPASSWD on nice',
                why: "nice's whole job is to launch a program at an adjusted CPU scheduling priority — it never inspects or restricts what that program is. sudo nice /bin/sh skips straight to running /bin/sh, just with a priority tweak nobody asked for, as root, since that's who sudo made nice run as.",
                fix: 'Never grant sudo on nice, or on any wrapper whose entire purpose is to launch an arbitrary program with some option applied. If a script legitimately needs a niced command, hard-code the exact command in sudoers instead of exposing the raw nice binary.',
                link: 'https://gtfobins.github.io/gtfobins/nice/'
            },
            fr: {
                vuln: 'Mauvaise config sudoers — NOPASSWD sur nice',
                why: "Le rôle de nice est de lancer un programme avec une priorité d'ordonnancement CPU ajustée — il n'inspecte ni ne restreint jamais ce programme. sudo nice /bin/sh se contente de lancer /bin/sh, avec un réglage de priorité que personne n'a demandé, en root, puisque c'est sous cette identité que sudo a fait tourner nice.",
                fix: 'Ne jamais donner sudo sur nice, ni sur un wrapper dont le seul rôle est de lancer un programme arbitraire avec une option appliquée. Si un script a légitimement besoin d\'une commande avec priorité ajustée, fige la commande exacte dans sudoers plutôt que d\'exposer le binaire nice brut.',
                link: 'https://gtfobins.github.io/gtfobins/nice/'
            },
            es: {
                vuln: 'Mala configuración sudoers — NOPASSWD en nice',
                why: 'El trabajo de nice es lanzar un programa con una prioridad de planificación de CPU ajustada — nunca inspecciona ni restringe cuál es ese programa. sudo nice /bin/sh va directo a ejecutar /bin/sh, solo con un ajuste de prioridad que nadie pidió, como root, ya que esa es la identidad bajo la que sudo hizo correr nice.',
                fix: 'Nunca des sudo sobre nice, ni sobre ningún wrapper cuyo único propósito sea lanzar un programa arbitrario con alguna opción aplicada. Si un script realmente necesita un comando con prioridad ajustada, codifica el comando exacto en sudoers en vez de exponer el binario nice en bruto.',
                link: 'https://gtfobins.github.io/gtfobins/nice/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 35 — Writable monitoring script run by root cron
    // ─────────────────────────────────────────────────────────────
    {
        id: 35,
        codename: 'box-35',
        title: { en: 'Box-35 · Watched Pot', fr: 'Box-35 · La marmite surveillée', es: 'Box-35 · La olla vigilada' },
        brief: {
            en: 'A monitoring agent runs as root every minute, health-checking a script it trusts a little too much.',
            fr: "Un agent de surveillance tourne en root chaque minute, vérifiant l'état d'un script auquel il fait un peu trop confiance.",
            es: 'Un agente de monitorización se ejecuta como root cada minuto, comprobando el estado de un script en el que confía un poco demasiado.'
        },
        user: 'player',
        host: 'box-35',
        cwd: '/home/player',
        objectives: {
            en: ['Read /etc/crontab', 'Find a writable script called by root', 'Overwrite it and wait for cron'],
            fr: ['Lire /etc/crontab', 'Trouver un script accessible en écriture appelé par root', 'Réécrire ce script et attendre cron'],
            es: ['Leer /etc/crontab', 'Encontrar un script escribible llamado por root', 'Sobrescribirlo y esperar a cron']
        },
        hints: {
            en: [
                'cat /etc/crontab shows system-wide jobs.',
                '/opt/monitor/healthcheck.sh runs as root every minute. Check its permissions: ls -la /opt/monitor/healthcheck.sh',
                'Overwrite the script: echo "cp /bin/sh /tmp/rootsh; chmod +s /tmp/rootsh" > /opt/monitor/healthcheck.sh — then type "wait".'
            ],
            fr: [
                'cat /etc/crontab affiche les jobs système.',
                '/opt/monitor/healthcheck.sh tourne en root chaque minute. Vérifie ses permissions : ls -la /opt/monitor/healthcheck.sh',
                'Réécris le script : echo "cp /bin/sh /tmp/rootsh; chmod +s /tmp/rootsh" > /opt/monitor/healthcheck.sh — puis tape "wait".'
            ],
            es: [
                'cat /etc/crontab muestra las tareas del sistema.',
                '/opt/monitor/healthcheck.sh se ejecuta como root cada minuto. Comprueba sus permisos: ls -la /opt/monitor/healthcheck.sh',
                'Sobrescribe el script: echo "cp /bin/sh /tmp/rootsh; chmod +s /tmp/rootsh" > /opt/monitor/healthcheck.sh — luego escribe "wait".'
            ]
        },
        flag: 'flag{h34lthcheck_hij4ck}',
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
*  *  *   *   *  root  /opt/monitor/healthcheck.sh
5  0  *   *   *  root  logrotate /etc/logrotate.conf
` },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{h34lthcheck_hij4ck}\n' },
            '/opt': { type: 'dir', owner: 'root', mode: '755', children: ['monitor'] },
            '/opt/monitor': { type: 'dir', owner: 'root', mode: '755', children: ['healthcheck.sh'] },
            '/opt/monitor/healthcheck.sh': { type: 'file', owner: 'root', mode: '777', writable_by_all: true, content:
`#!/bin/sh
# Service health probe — pings local endpoints, logs failures
echo "healthcheck ok at $(date)" >> /var/log/monitor.log
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
            '/bin/sh': ELF_BIN()
        },
        wins: [
            { type: 'cron_hijack', path: '/opt/monitor/healthcheck.sh' }
        ],
        harden: {
            type: 'lock_perms', target: '/opt/monitor/healthcheck.sh',
            obj: { en: 'Make /opt/monitor/healthcheck.sh no longer world-writable', fr: 'Rends /opt/monitor/healthcheck.sh non modifiable par tous', es: 'Haz que /opt/monitor/healthcheck.sh ya no sea escribible por todos' },
            hint: { en: 'chmod 700 /opt/monitor/healthcheck.sh', fr: 'chmod 700 /opt/monitor/healthcheck.sh', es: 'chmod 700 /opt/monitor/healthcheck.sh' }
        },
        debrief: {
            en: {
                vuln: 'World-writable cron script (monitoring agent)',
                why: "root's crontab runs /opt/monitor/healthcheck.sh every minute to probe service health, but the script itself is writable by any user (mode 777). A monitoring script feels lower-stakes than a backup job — it doesn't touch data — but it runs with exactly the same root privilege, so overwriting it is just as complete a takeover.",
                fix: 'Scripts run by root must never be group- or world-writable, regardless of how mundane their job looks. Set correct ownership and permissions (chmod 700, chown root:root) on any file referenced by a privileged cron job, and audit /etc/crontab and cron.d entries for what they call — monitoring and health-check tooling included.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation'
            },
            fr: {
                vuln: 'Script cron accessible en écriture pour tous (agent de surveillance)',
                why: "Le crontab root exécute /opt/monitor/healthcheck.sh chaque minute pour sonder l'état des services, mais le script lui-même est accessible en écriture par n'importe quel utilisateur (mode 777). Un script de surveillance paraît moins sensible qu'un job de sauvegarde — il ne touche pas aux données — mais il tourne avec exactement le même privilège root, donc l'écraser est une prise de contrôle tout aussi complète.",
                fix: "Un script exécuté par root ne doit jamais être accessible en écriture au groupe ou à tous, peu importe à quel point sa tâche paraît anodine. Fixe les bons propriétaire/permissions (chmod 700, chown root:root) sur tout fichier appelé par un job cron privilégié, et audite /etc/crontab et cron.d — outils de surveillance et de health-check inclus.",
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation'
            },
            es: {
                vuln: 'Script de cron escribible por todos (agente de monitorización)',
                why: 'El crontab de root ejecuta /opt/monitor/healthcheck.sh cada minuto para sondear el estado de los servicios, pero el script en sí es escribible por cualquier usuario (modo 777). Un script de monitorización parece menos delicado que una tarea de backup — no toca datos — pero se ejecuta con exactamente el mismo privilegio de root, así que sobrescribirlo es una toma de control igual de completa.',
                fix: 'Los scripts ejecutados por root nunca deben ser escribibles por el grupo ni por todos, sin importar lo mundana que parezca su tarea. Fija el propietario y los permisos correctos (chmod 700, chown root:root) en cualquier archivo referenciado por una tarea cron privilegiada, y audita las entradas de /etc/crontab y cron.d — herramientas de monitorización y health-check incluidas.',
                link: 'https://book.hacktricks.xyz/linux-hardening/privilege-escalation'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 36 — sudo NOPASSWD on zip (GTFOBins, unzip-command hook)
    // ─────────────────────────────────────────────────────────────
    {
        id: 36,
        codename: 'box-36',
        title: { en: 'Box-36 · Zipped Up', fr: 'Box-36 · Bien fermé', es: 'Box-36 · Bien cerrado' },
        brief: {
            en: "sudo -l grants zip — an archiving tool. It just compresses files... and then, if you ask it to test its own work, runs whatever you tell it to test with.",
            fr: "sudo -l accorde zip — un outil d'archivage. Il ne fait que compresser des fichiers... et, si tu lui demandes de tester son propre travail, lance ce que tu lui dis d'utiliser pour tester.",
            es: 'sudo -l concede zip — una herramienta de archivado. Solo comprime archivos... y luego, si le pides que pruebe su propio trabajo, ejecuta lo que le digas que use para probarlo.'
        },
        user: 'player',
        host: 'box-36',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recognise zip\'s -T test hook on GTFOBins', 'Use it to launch a root shell'],
            fr: ['Vérifier tes droits sudo', 'Reconnaître le hook de test -T de zip sur GTFOBins', 'L\'utiliser pour lancer un shell root'],
            es: ['Comprobar tus permisos sudo', 'Reconocer el hook de prueba -T de zip en GTFOBins', 'Usarlo para lanzar un shell root']
        },
        hints: {
            en: [
                'Try: sudo -l',
                'zip -T tests the archive it just built by running a configurable "unzip command" against it. Check GTFOBins for "zip".',
                'Payload: sudo zip test.zip /etc/hosts -T --unzip-command="sh -c /bin/sh"'
            ],
            fr: [
                'Essaie : sudo -l',
                'zip -T teste l\'archive qu\'il vient de créer en lançant une "commande unzip" configurable dessus. Regarde GTFOBins pour "zip".',
                'Payload : sudo zip test.zip /etc/hosts -T --unzip-command="sh -c /bin/sh"'
            ],
            es: [
                'Prueba: sudo -l',
                'zip -T prueba el archivo que acaba de crear ejecutando un "comando unzip" configurable sobre él. Consulta GTFOBins para "zip".',
                'Payload: sudo zip test.zip /etc/hosts -T --unzip-command="sh -c /bin/sh"'
            ]
        },
        flag: 'flag{unz1p_c0mmand_r00t}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd', 'hosts'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/etc/hosts': { type: 'file', owner: 'root', mode: '644', content: '127.0.0.1 localhost\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{unz1p_c0mmand_r00t}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'zip'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/zip': ELF_BIN(),
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': ELF_BIN()
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/zip', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers misconfiguration — NOPASSWD on zip',
                why: "zip's -T flag re-opens the archive it just wrote to make sure it isn't corrupt, by handing it to an \"unzip command\" — meant to be unzip itself, but --unzip-command accepts any program. zip never validates that the command it's about to run is actually an unzip tool; it just runs it, as whatever user zip itself is running as.",
                fix: 'Never grant sudo on zip (or any archiver with a configurable test/verify hook) without restricting arguments. If a script only ever needs zip to compress files non-interactively, drop the NOPASSWD entry down to that exact invocation rather than the bare binary.',
                link: 'https://gtfobins.github.io/gtfobins/zip/'
            },
            fr: {
                vuln: 'Mauvaise config sudoers — NOPASSWD sur zip',
                why: "Le flag -T de zip rouvre l'archive qu'il vient d'écrire pour vérifier qu'elle n'est pas corrompue, en la confiant à une \"commande unzip\" — censée être unzip lui-même, mais --unzip-command accepte n'importe quel programme. zip ne vérifie jamais que la commande qu'il s'apprête à lancer est vraiment un outil de décompression ; il la lance, tout simplement, avec l'identité sous laquelle zip lui-même tourne.",
                fix: "Ne jamais donner sudo sur zip (ou tout archiveur avec un hook de test/vérification configurable) sans restreindre les arguments. Si un script n'a besoin de zip que pour compresser des fichiers de façon non interactive, réduis l'entrée NOPASSWD à cet appel exact plutôt qu'au binaire brut.",
                link: 'https://gtfobins.github.io/gtfobins/zip/'
            },
            es: {
                vuln: 'Mala configuración sudoers — NOPASSWD en zip',
                why: 'El flag -T de zip reabre el archivo que acaba de escribir para asegurarse de que no está corrupto, entregándoselo a un "comando unzip" — pensado para ser el propio unzip, pero --unzip-command acepta cualquier programa. zip nunca valida que el comando que está a punto de ejecutar sea realmente una herramienta de descompresión; simplemente lo ejecuta, con la identidad del usuario bajo la que se ejecuta el propio zip.',
                fix: 'Nunca des sudo sobre zip (ni sobre ningún archivador con un hook de prueba/verificación configurable) sin restringir los argumentos. Si un script solo necesita zip para comprimir archivos de forma no interactiva, reduce la entrada NOPASSWD a esa invocación exacta en vez del binario en bruto.',
                link: 'https://gtfobins.github.io/gtfobins/zip/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 37 — sudo NOPASSWD on rsync (GTFOBins, -e remote-shell swap)
    // ─────────────────────────────────────────────────────────────
    {
        id: 37,
        codename: 'box-37',
        title: { en: 'Box-37 · Out of Sync', fr: 'Box-37 · Désynchronisé', es: 'Box-37 · Desincronizado' },
        brief: {
            en: "sudo -l grants rsync — a file-sync tool. It just copies files between hosts efficiently... using whatever program you tell it to reach the remote host with.",
            fr: "sudo -l accorde rsync — un outil de synchronisation de fichiers. Il ne fait que copier des fichiers entre hôtes efficacement... en utilisant le programme que tu lui dis d'employer pour joindre l'hôte distant.",
            es: 'sudo -l concede rsync — una herramienta de sincronización de archivos. Solo copia archivos entre hosts de forma eficiente... usando el programa que le digas para llegar al host remoto.'
        },
        user: 'player',
        host: 'box-37',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recognise rsync\'s -e remote-shell flag on GTFOBins', 'Use it to launch a root shell'],
            fr: ['Vérifier tes droits sudo', 'Reconnaître le flag -e (shell distant) de rsync sur GTFOBins', 'L\'utiliser pour lancer un shell root'],
            es: ['Comprobar tus permisos sudo', 'Reconocer el flag -e (shell remoto) de rsync en GTFOBins', 'Usarlo para lanzar un shell root']
        },
        hints: {
            en: [
                'Try: sudo -l',
                'rsync\'s -e flag picks which program it uses to reach a "remote" host — it\'s meant to be ssh, but rsync will run anything you name. Check GTFOBins for "rsync".',
                'Payload: sudo rsync -e "/bin/sh -c /bin/sh" 127.0.0.1:/dev/null /dev/null'
            ],
            fr: [
                'Essaie : sudo -l',
                'Le flag -e de rsync choisit quel programme il utilise pour joindre un hôte "distant" — censé être ssh, mais rsync lancera tout ce que tu nommes. Regarde GTFOBins pour "rsync".',
                'Payload : sudo rsync -e "/bin/sh -c /bin/sh" 127.0.0.1:/dev/null /dev/null'
            ],
            es: [
                'Prueba: sudo -l',
                'El flag -e de rsync elige qué programa usa para llegar a un host "remoto" — se supone que es ssh, pero rsync ejecutará lo que sea que nombres. Consulta GTFOBins para "rsync".',
                'Payload: sudo rsync -e "/bin/sh -c /bin/sh" 127.0.0.1:/dev/null /dev/null'
            ]
        },
        flag: 'flag{rsync_r3mote_sh3ll_r00t}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin', 'dev'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{rsync_r3mote_sh3ll_r00t}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'rsync'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/rsync': ELF_BIN(),
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/dev': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': ELF_BIN()
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/rsync', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers misconfiguration — NOPASSWD on rsync',
                why: "rsync's -e flag exists to let you swap in a different remote-shell program instead of the default ssh — a legitimate feature for unusual network setups. rsync never checks that what you hand it is actually a shell client; it just execs it. Pointing -e at /bin/sh runs a shell directly, with rsync's own privilege, before rsync ever needs to \"reach\" anything.",
                fix: "Never grant sudo on rsync without pinning the exact source/destination and forbidding flag injection (Defaults!/usr/bin/rsync !env_reset alone isn't enough — the -e flag is the issue, not the environment). If a script needs privileged rsync, wrap it so extra flags can't be appended, or use a dedicated service account with no shell instead.",
                link: 'https://gtfobins.github.io/gtfobins/rsync/'
            },
            fr: {
                vuln: 'Mauvaise config sudoers — NOPASSWD sur rsync',
                why: "Le flag -e de rsync existe pour permettre de remplacer le programme de shell distant par défaut (ssh) — une fonctionnalité légitime pour des configurations réseau particulières. rsync ne vérifie jamais que ce qu'on lui donne est vraiment un client shell ; il l'exécute, tout simplement. Pointer -e vers /bin/sh lance un shell directement, avec le privilège de rsync lui-même, avant même que rsync n'ait besoin de \"joindre\" quoi que ce soit.",
                fix: "Ne jamais donner sudo sur rsync sans figer précisément la source/destination et interdire l'injection de flags (Defaults!/usr/bin/rsync !env_reset seul ne suffit pas — le problème est le flag -e, pas l'environnement). Si un script a besoin de rsync privilégié, encapsule-le pour empêcher l'ajout de flags, ou utilise un compte de service dédié sans shell.",
                link: 'https://gtfobins.github.io/gtfobins/rsync/'
            },
            es: {
                vuln: 'Mala configuración sudoers — NOPASSWD en rsync',
                why: 'El flag -e de rsync existe para permitir sustituir el programa de shell remoto por defecto (ssh) — una función legítima para configuraciones de red poco habituales. rsync nunca comprueba que lo que le pasas sea realmente un cliente de shell; simplemente lo ejecuta. Apuntar -e a /bin/sh lanza un shell directamente, con el propio privilegio de rsync, antes incluso de que rsync necesite "llegar" a ningún sitio.',
                fix: 'Nunca des sudo sobre rsync sin fijar exactamente el origen/destino y prohibir la inyección de flags (Defaults!/usr/bin/rsync !env_reset por sí solo no basta — el problema es el flag -e, no el entorno). Si un script necesita rsync privilegiado, envuélvelo para que no se puedan añadir flags extra, o usa una cuenta de servicio dedicada sin shell.',
                link: 'https://gtfobins.github.io/gtfobins/rsync/'
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    // LEVEL 38 — sudo NOPASSWD on make (GTFOBins, --eval rule injection)
    // ─────────────────────────────────────────────────────────────
    {
        id: 38,
        codename: 'box-38',
        title: { en: 'Box-38 · Build Broken', fr: 'Box-38 · Build cassé', es: 'Box-38 · Build roto' },
        brief: {
            en: "sudo -l grants make — a build tool. It just follows the rules written in a Makefile... and, if you hand it a rule directly on the command line, follows that one too.",
            fr: "sudo -l accorde make — un outil de build. Il ne fait que suivre les règles écrites dans un Makefile... et, si tu lui en donnes une directement en ligne de commande, il suit aussi celle-là.",
            es: 'sudo -l concede make — una herramienta de build. Solo sigue las reglas escritas en un Makefile... y, si le pasas una regla directamente en la línea de comandos, sigue también esa.'
        },
        user: 'player',
        host: 'box-38',
        cwd: '/home/player',
        objectives: {
            en: ['Check your sudo permissions', 'Recognise make\'s --eval rule-injection flag on GTFOBins', 'Use it to launch a root shell'],
            fr: ['Vérifier tes droits sudo', 'Reconnaître le flag d\'injection de règle --eval de make sur GTFOBins', 'L\'utiliser pour lancer un shell root'],
            es: ['Comprobar tus permisos sudo', 'Reconocer el flag de inyección de reglas --eval de make en GTFOBins', 'Usarlo para lanzar un shell root']
        },
        hints: {
            en: [
                'Try: sudo -l',
                'make normally reads rules from a Makefile — but --eval lets you inject a rule straight from the command line, before any file is read. Check GTFOBins for "make".',
                'Payload: sudo make -s --eval="x:\\n\\t-/bin/sh"'
            ],
            fr: [
                'Essaie : sudo -l',
                'make lit normalement ses règles depuis un Makefile — mais --eval permet d\'injecter une règle directement en ligne de commande, avant toute lecture de fichier. Regarde GTFOBins pour "make".',
                'Payload : sudo make -s --eval="x:\\n\\t-/bin/sh"'
            ],
            es: [
                'Prueba: sudo -l',
                'make normalmente lee sus reglas desde un Makefile — pero --eval permite inyectar una regla directamente desde la línea de comandos, antes de leer ningún archivo. Consulta GTFOBins para "make".',
                'Payload: sudo make -s --eval="x:\\n\\t-/bin/sh"'
            ]
        },
        flag: 'flag{m4ke_eval_r00t}',
        fs: {
            '/': { type: 'dir', owner: 'root', mode: '755', children: ['home', 'etc', 'usr', 'tmp', 'var', 'root', 'bin'] },
            '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
            '/home/player': { type: 'dir', owner: 'player', mode: '755', children: ['.bashrc'] },
            '/home/player/.bashrc': { type: 'file', owner: 'player', mode: '644', content: '# ~/.bashrc\n' },
            '/etc': { type: 'dir', owner: 'root', mode: '755', children: ['passwd'] },
            '/etc/passwd': { type: 'file', owner: 'root', mode: '644', content: 'root:x:0:0:root:/root:/bin/bash\nplayer:x:1000:1000:player:/home/player:/bin/bash\n' },
            '/root': { type: 'dir', owner: 'root', mode: '700', children: ['flag.txt'] },
            '/root/flag.txt': { type: 'file', owner: 'root', mode: '600', content: 'flag{m4ke_eval_r00t}\n' },
            '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
            '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['ls', 'cat', 'sh', 'bash', 'sudo', 'make'] },
            '/usr/bin/ls': ELF_BIN(),
            '/usr/bin/cat': ELF_BIN(),
            '/usr/bin/sh': ELF_BIN(),
            '/usr/bin/bash': ELF_BIN(),
            '/usr/bin/sudo': SUID_BIN(),
            '/usr/bin/make': ELF_BIN(),
            '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
            '/var': { type: 'dir', owner: 'root', mode: '755', children: [] },
            '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh'] },
            '/bin/sh': ELF_BIN()
        },
        sudoers: {
            player: [
                { cmd: '/usr/bin/make', nopasswd: true, runas: 'root' }
            ]
        },
        wins: [
            { type: 'sudo_shell' }
        ],
        debrief: {
            en: {
                vuln: 'Sudoers misconfiguration — NOPASSWD on make',
                why: "make's --eval flag injects a rule into its internal makefile before it ever opens a Makefile from disk — a convenience for one-off builds, not something anyone treats as a code-execution primitive. A rule whose recipe is a shell command runs during the recipe-execution phase exactly like any other rule would, with whatever privilege make itself has.",
                fix: 'Never grant sudo on make (or any build/automation tool that accepts inline rules, targets, or hooks) without pinning it to a specific Makefile and forbidding extra flags. If a script only ever needs make to build one target non-interactively, restrict the sudoers entry to that exact invocation rather than the bare binary.',
                link: 'https://gtfobins.github.io/gtfobins/make/'
            },
            fr: {
                vuln: 'Mauvaise config sudoers — NOPASSWD sur make',
                why: "Le flag --eval de make injecte une règle dans son makefile interne avant même d'ouvrir un Makefile sur disque — une commodité pour des builds ponctuels, pas quelque chose que l'on considère comme une primitive d'exécution de code. Une règle dont la recette est une commande shell s'exécute pendant la phase d'exécution des recettes, exactement comme n'importe quelle autre règle, avec le privilège que make lui-même possède.",
                fix: "Ne jamais donner sudo sur make (ou tout outil de build/automatisation acceptant des règles, cibles ou hooks en ligne) sans le figer sur un Makefile précis et interdire les flags supplémentaires. Si un script n'a besoin de make que pour construire une cible de façon non interactive, réduis l'entrée sudoers à cet appel exact plutôt qu'au binaire brut.",
                link: 'https://gtfobins.github.io/gtfobins/make/'
            },
            es: {
                vuln: 'Mala configuración sudoers — NOPASSWD en make',
                why: 'El flag --eval de make inyecta una regla en su makefile interno antes incluso de abrir un Makefile del disco — una comodidad para builds puntuales, no algo que nadie trate como una primitiva de ejecución de código. Una regla cuya receta es un comando de shell se ejecuta durante la fase de ejecución de recetas exactamente igual que cualquier otra regla, con el privilegio que tenga el propio make.',
                fix: 'Nunca des sudo sobre make (ni sobre ninguna herramienta de build/automatización que acepte reglas, objetivos o hooks en línea) sin fijarlo a un Makefile específico y prohibir flags adicionales. Si un script solo necesita make para construir un objetivo de forma no interactiva, restringe la entrada sudoers a esa invocación exacta en vez del binario en bruto.',
                link: 'https://gtfobins.github.io/gtfobins/make/'
            }
        }
    }
];
