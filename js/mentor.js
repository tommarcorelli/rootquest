// mentor.js — "Mentor" coaching engine (v1.26).
//
// Distinct from the existing hint system (🔎, 3 fixed hints/box, costs
// score) and from explanation mode (🎓, full worked solution, opt-in
// spoiler). The Mentor never spoils a solution and never touches scoring —
// it watches *how the session is going* (commands typed, errors, whether
// the box's category-appropriate recon has happened yet) and drops an
// occasional, in-character, natural-language nudge into the terminal, the
// way a human looking over your shoulder would. No external LLM: a small
// rule engine driven by data already on hand (MACHINE_META[].cat,
// CHEATS_BY_CAT, SESSION, the `err` class already on failed-command lines).
//
// Opt-in via the 🧭 topbar button (state in window.MENTORMODE, persisted).
window.MENTOR = {
    // Per-level session log — reset in resetForLevel().
    log: [],           // raw command strings typed this machine
    lastNudgeAt: 0,     // SESSION.cmdCount value at the last nudge (rate limit)
    fired: new Set(),   // Set of rule ids already used this machine (each fires once)
    reconSeenAt: 0,      // cmdCount when the category recon command was first spotted, or 0

    inspected: {},       // path -> times looked at without ever being run
    _errStreak: 0,

    MIN_GAP: 4,          // minimum commands between two nudges
    RECON_THRESHOLD: 7,  // nudge toward recon if not attempted by this many commands
    STUCK_THRESHOLD: 9,  // nudge toward "next step" this many commands after recon was spotted
    LOST_THRESHOLD: 22,  // last-resort meta nudge, points back at the hint button
    LOOP_THRESHOLD: 3,   // same command this many times in the last few entries
    IDLE_THRESHOLD: 6,   // commands to sit on a found-but-unused binary before nudging

    // Difficulty changes what "taking a while" means. On an ADVANCED box,
    // fifteen commands of careful enumeration is good practice, not being
    // stuck — nudging there would be nagging. Thresholds scale with the tier.
    TIER_PACE: { EASY: 0.8, MEDIUM: 1, HARD: 1.45, CUSTOM: 1 },
    pace() {
        const meta = (window.MACHINE_META && window.GAME && window.MACHINE_META[window.GAME.currentLevel]) || {};
        return this.TIER_PACE[meta.diff] || 1;
    },
    at(threshold) { return Math.round(threshold * this.pace()); },

    resetForLevel() {
        this.log = [];
        this.lastNudgeAt = 0;
        this.fired = new Set();
        this.reconSeenAt = 0;
        this.inspected = {};
        this._errStreak = 0;
    },

    // A rough per-category regex for "the player just did the recon move
    // that opens this category" — doesn't need to be exhaustive, it only
    // gates a nudge, never blocks progress if it misses.
    RECON_PATTERNS: {
        SUID: /find\s.*-perm|(?:^|\s)-4000|-u=s/i,
        PATH: /find\s.*-perm|(?:^|\s)-4000|-u=s/i,
        CRON: /crontab|\/etc\/cron/i,
        WILDCARD: /crontab|\/etc\/cron/i,
        CAP: /getcap/i,
        SUDO: /sudo\s+-l/i,
        SUDOERS: /sudo\s+-l|\/etc\/sudoers/i,
        PRELOAD: /sudo\s+-l/i,
        'LD.LIBPATH': /sudo\s+-l/i,
        EDITOR: /sudo\s+-l/i,
        PASSWD: /\/etc\/passwd/i,
        KERNEL: /uname\s+-a|os-release/i,
        CHAIN: /config\.php|sudo\s+-l/i,
        DOCKER: /\bid\b|\/etc\/group/i,
        SSH: /\/opt\/backup/i,
        'LD.PRELOAD': /ld\.so\.preload/i,
        NFS: /showmount/i,
        LXD: /\bid\b|\/etc\/group|\blxc\b/i,
        SYSTEMD: /systemctl|\/etc\/systemd/i
    },

    // The category-flavored "have you thought about..." line for the recon
    // nudge — suggestive, never the literal command. Falls back to a
    // generic line for CUSTOM/unknown categories.
    CATEGORY_FLAVOR: {
        SUID: { en: "Boxes like this one often open up through SUID binaries — files that run with their owner's rights no matter who launches them. Ring a bell?", fr: "Sur ce genre de machine, l'entrée passe souvent par des binaires SUID — des fichiers qui s'exécutent avec les droits de leur propriétaire, peu importe qui les lance. Ça te dit quelque chose ?", es: "En este tipo de máquina, la entrada suele pasar por binarios SUID — archivos que se ejecutan con los permisos de su propietario, sin importar quién los lance. ¿Te suena?" },
        CRON: { en: "Something running automatically, on a schedule, as root — and maybe writable by you? Worth a look at what's scheduled.", fr: "Quelque chose qui s'exécute automatiquement, à intervalle régulier, en root — et peut-être modifiable par toi ? Ça vaut le coup de regarder ce qui est planifié.", es: "¿Algo que se ejecuta automáticamente, de forma programada, como root — y quizás escribible por ti? Vale la pena mirar qué hay programado." },
        CAP: { en: "Forget SUID for a second — Linux capabilities can hand a binary root-level powers without the SUID bit at all. Worth checking which binaries carry any.", fr: "Oublie le SUID une seconde — les capabilities Linux peuvent donner à un binaire des pouvoirs de root sans même poser le bit SUID. Ça vaut le coup de vérifier quels binaires en portent.", es: "Olvida el SUID por un momento — las capabilities de Linux pueden dar a un binario poderes de nivel root sin necesidad del bit SUID. Vale la pena comprobar qué binarios tienen alguna." },
        PATH: { en: "A root script calling another command by name, not by full path, while you control what comes first in the search order? Classic move.", fr: "Un script root qui appelle une autre commande par son nom, pas par son chemin complet, pendant que tu contrôles ce qui passe en premier dans l'ordre de recherche ? Un grand classique.", es: "¿Un script root que llama a otro comando por su nombre, no por su ruta completa, mientras tú controlas qué aparece primero en el orden de búsqueda? Un clásico." },
        SUDO: { en: "What are you actually allowed to run as another user here? Always worth checking early.", fr: "Qu'as-tu le droit de lancer en tant qu'un autre utilisateur ici ? Ça vaut toujours le coup de vérifier tôt.", es: "¿Qué tienes permitido ejecutar realmente como otro usuario aquí? Siempre vale la pena comprobarlo pronto." },
        SUDOERS: { en: "Somewhere in this system's sudo configuration, someone may have been a little too generous. Worth a look.", fr: "Quelque part dans la configuration sudo de ce système, quelqu'un a peut-être été un peu trop généreux. Ça vaut le coup d'y jeter un œil.", es: "En algún lugar de la configuración sudo de este sistema, alguien pudo haber sido un poco demasiado generoso. Vale la pena echar un vistazo." },
        PASSWD: { en: "Who owns /etc/passwd, and can you write to it? That one file is more powerful than it looks.", fr: "Qui possède /etc/passwd, et peux-tu y écrire ? Ce fichier est plus puissant qu'il n'y paraît.", es: "¿Quién es dueño de /etc/passwd, y puedes escribir en él? Ese archivo es más poderoso de lo que parece." },
        KERNEL: { en: "Sometimes the fastest way in isn't a misconfiguration at all — it's an outdated kernel with a known exploit. Worth knowing what you're running.", fr: "Parfois la voie la plus rapide n'est pas une mauvaise config — c'est un noyau obsolète avec une faille connue. Ça vaut le coup de savoir ce que tu fais tourner.", es: "A veces el camino más rápido no es una mala configuración en absoluto — es un kernel desactualizado con un exploit conocido. Vale la pena saber qué estás usando." },
        CHAIN: { en: "This one won't fall in a single step. Look for something lying around in plain sight first, then think about what door it opens.", fr: "Celle-ci ne tombera pas en une étape. Cherche d'abord quelque chose qui traîne à la vue de tous, puis réfléchis à quelle porte ça ouvre.", es: "Esta no caerá en un solo paso. Busca primero algo que esté a la vista, luego piensa qué puerta abre." },
        DOCKER: { en: "Being in a certain group can be as good as being root, if that group controls something powerful enough. Worth checking which groups you're in.", fr: "Appartenir à un certain groupe peut valoir autant qu'être root, si ce groupe contrôle quelque chose d'assez puissant. Ça vaut le coup de vérifier tes groupes.", es: "Pertenecer a cierto grupo puede valer tanto como ser root, si ese grupo controla algo suficientemente poderoso. Vale la pena comprobar tus grupos." },
        PRELOAD: { en: "If sudo lets you keep an environment variable that controls what code loads before a program even starts, that's a door.", fr: "Si sudo te laisse conserver une variable d'environnement qui contrôle quel code se charge avant même qu'un programme démarre, c'est une porte.", es: "Si sudo te deja conservar una variable de entorno que controla qué código se carga antes de que un programa siquiera arranque, eso es una puerta." },
        WILDCARD: { en: "A root script using a wildcard (*) can sometimes be tricked — some tools treat a filename starting with '-' as an option, not a file.", fr: "Un script root qui utilise un joker (*) peut parfois être piégé — certains outils traitent un nom de fichier commençant par '-' comme une option, pas un fichier.", es: "Un script root que usa un comodín (*) a veces puede ser engañado — algunas herramientas tratan un nombre de archivo que empieza por '-' como una opción, no como un archivo." },
        SSH: { en: "A backup lying around might contain more than expected — like a key that opens a door somewhere else.", fr: "Une sauvegarde qui traîne peut contenir plus que prévu — comme une clé qui ouvre une porte ailleurs.", es: "Una copia de seguridad olvidada por ahí puede contener más de lo esperado — como una llave que abre una puerta en otro lugar." },
        SUDOERS_D: { en: "Somewhere a sudo rule may have been dropped in as its own file, not in the main config. Worth a look around /etc/sudoers.d.", fr: "Quelque part, une règle sudo a peut-être été déposée dans son propre fichier, pas dans la config principale. Ça vaut le coup de regarder du côté de /etc/sudoers.d.", es: "En algún lugar, una regla sudo pudo haberse depositado en su propio archivo, no en la configuración principal. Vale la pena mirar por /etc/sudoers.d." },
        'LD.PRELOAD': { en: "There's a global preload file that loads its listed library into every dynamically linked SUID binary. Who can write to it?", fr: "Il existe un fichier de préchargement global qui charge sa bibliothèque dans chaque binaire SUID lié dynamiquement. Qui peut y écrire ?", es: "Existe un archivo de precarga global que carga su biblioteca en cada binario SUID enlazado dinámicamente. ¿Quién puede escribir en él?" },
        'LD.LIBPATH': { en: "A binary looking for a library by name, not by path, trusts whatever shows up first in its search path. Related to LD_PRELOAD, but not quite the same trick.", fr: "Un binaire qui cherche une bibliothèque par son nom, pas par son chemin, fait confiance à ce qui arrive en premier dans son chemin de recherche. Proche de LD_PRELOAD, mais pas tout à fait la même astuce.", es: "Un binario que busca una biblioteca por su nombre, no por su ruta, confía en lo primero que aparezca en su ruta de búsqueda. Relacionado con LD_PRELOAD, pero no exactamente el mismo truco." },
        NFS: { en: "Some network shares trust the client's claimed user ID a little too much. Worth checking what's exported and whether root gets squashed.", fr: "Certains partages réseau font un peu trop confiance à l'identité déclarée par le client. Ça vaut le coup de vérifier ce qui est exporté et si root est bridé.", es: "Algunas comparticiones de red confían un poco demasiado en el ID de usuario que declara el cliente. Vale la pena comprobar qué se exporta y si root queda restringido." },
        EDITOR: { en: "sudo can let you edit a file as root without ever running it directly — but it still has to launch an editor to do that. Which editor, exactly?", fr: "sudo peut te laisser éditer un fichier en root sans jamais l'exécuter directement — mais il doit quand même lancer un éditeur pour ça. Lequel, au juste ?", es: "sudo puede dejarte editar un archivo como root sin ejecutarlo nunca directamente — pero igualmente tiene que lanzar un editor para hacerlo. ¿Cuál, exactamente?" },
        LXD: { en: "Being in a certain group can be as good as being root — and docker isn't the only one. Check every group you're in; some of them can drive a daemon that runs as root.", fr: "Appartenir à un certain groupe peut valoir root — et docker n'est pas le seul. Vérifie chaque groupe dont tu fais partie ; certains peuvent piloter un daemon qui tourne en root.", es: "Pertenecer a cierto grupo puede valer tanto como root — y docker no es el único. Revisa cada grupo al que perteneces; algunos pueden manejar un daemon que corre como root." },
        SYSTEMD: { en: "Something runs on a schedule as root here — but this time look at what starts it, not just the script. Who can write to the unit file itself?", fr: "Quelque chose tourne à intervalle régulier en root ici — mais cette fois regarde ce qui le lance, pas seulement le script. Qui peut écrire dans le fichier d'unité lui-même ?", es: "Algo se ejecuta de forma programada como root aquí — pero esta vez mira qué lo lanza, no solo el script. ¿Quién puede escribir en el propio archivo de unidad?" },
        DEFAULT: { en: "No rush. On a box like this, the first useful move is usually just looking around carefully — who you are, where you are, what's around you.", fr: "Pas de précipitation. Sur ce genre de machine, le premier réflexe utile est en général de bien regarder autour de toi — qui tu es, où tu es, ce qu'il y a autour.", es: "Sin prisa. En una máquina así, el primer movimiento útil suele ser simplemente mirar bien alrededor — quién eres, dónde estás, qué hay a tu alrededor." }
    },

    reconLine(cat) {
        return this.CATEGORY_FLAVOR[cat] || this.CATEGORY_FLAVOR.DEFAULT;
    },

    stuckLine() {
        return {
            en: "You're clearly onto something. Once you've got a hand on it, the next question is always the same: what does this actually let you *do* — and does it run as someone more privileged than you?",
            fr: "Tu tiens clairement quelque chose. Une fois que tu l'as en main, la question suivante est toujours la même : qu'est-ce que ça te permet réellement de *faire* — et est-ce que ça tourne avec des droits plus élevés que les tiens ?",
            es: "Claramente has encontrado algo. Una vez que lo tienes controlado, la siguiente pregunta es siempre la misma: ¿qué te permite realmente *hacer* — y se ejecuta con más privilegios que los tuyos?"
        };
    },

    errorStreakLine() {
        return {
            en: "No harm in an error — it's information, not a dead end. The message usually says exactly what's blocking you; worth reading it twice before moving on.",
            fr: "Une erreur n'est pas grave — c'est de l'information, pas une impasse. Le message dit en général exactement ce qui bloque ; ça vaut le coup de le relire avant de passer à autre chose.",
            es: "Un error no es grave — es información, no un callejón sin salida. El mensaje suele decir exactamente qué te está bloqueando; vale la pena leerlo dos veces antes de seguir."
        };
    },

    lostLine() {
        return {
            en: "You've tried a lot of things on this one. If you'd rather have something more direct, the hint button (🔎) is right there — no shame in it.",
            fr: "Tu as essayé pas mal de choses sur celle-ci. Si tu préfères quelque chose de plus direct, le bouton indice (🔎) est juste là — pas de honte à ça.",
            es: "Has probado muchas cosas en esta. Si prefieres algo más directo, el botón de pista (🔎) está justo ahí — sin ninguna vergüenza."
        };
    },

    loopLine(cmd) {
        return {
            en: `You've run \`${cmd}\` several times now and it's answering the same thing each time. It isn't going to change its mind — the next move is a different question, not a louder version of this one.`,
            fr: `Tu as lancé \`${cmd}\` plusieurs fois et il répond la même chose à chaque fois. Il ne va pas changer d'avis — la suite, c'est une autre question, pas la même en plus insistant.`,
            es: `Has ejecutado \`${cmd}\` varias veces y responde lo mismo cada vez. No va a cambiar de opinión — el siguiente paso es otra pregunta, no la misma más insistente.`
        };
    },

    idleFindLine(path) {
        return {
            en: `You found \`${path}\` and you've looked at it more than once, but you've never actually run it. Reading a binary tells you it exists; running it tells you what it hands you.`,
            fr: `Tu as trouvé \`${path}\` et tu l'as regardé plus d'une fois, mais tu ne l'as jamais lancé. Lire un binaire dit qu'il existe ; l'exécuter dit ce qu'il te donne.`,
            es: `Encontraste \`${path}\` y lo has mirado más de una vez, pero nunca lo has ejecutado. Leer un binario te dice que existe; ejecutarlo te dice qué te ofrece.`
        };
    },

    // ── Observation helpers (pure, so the harness can drive them) ────────
    // A command is "inspecting" a path when it only reads metadata/content;
    // it is "using" it when the path is the command word itself.
    INSPECT_RE: /^\s*(ls|cat|file|stat|getcap|head|tail|strings|less|more)\b/,
    // Paths worth tracking: things you could plausibly execute.
    BIN_RE: /(^|\s)(\/(?:usr\/local\/|usr\/|opt\/|s?bin\/)\S+)/,

    // Records interest in a binary the player keeps reading but never runs.
    observePaths(raw) {
        const cmd = String(raw || '');
        const first = cmd.trim().split(/\s+/)[0] || '';
        // Running it (directly or via sudo/exec) clears it from the watch list.
        const ran = cmd.match(/(?:^|\s|sudo\s+|exec\s+)(\/(?:usr\/local\/|usr\/|opt\/|s?bin\/)\S+)/);
        if (ran && !this.INSPECT_RE.test(cmd)) { delete this.inspected[ran[1]]; return; }
        if (!this.INSPECT_RE.test(cmd)) return;
        const m = cmd.slice(first.length).match(this.BIN_RE);
        if (!m) return;
        const path = m[2].replace(/[;)'"]+$/, '');
        this.inspected[path] = (this.inspected[path] || 0) + 1;
    },

    // The path the player has read at least twice and never executed, if any.
    idleFind() {
        for (const [path, seen] of Object.entries(this.inspected)) {
            if (seen >= 2) return path;
        }
        return null;
    },

    // The command repeated LOOP_THRESHOLD times in the recent window, if any.
    loopingCommand() {
        const recent = this.log.slice(-6).map(c => String(c).trim()).filter(Boolean);
        const counts = {};
        for (const c of recent) counts[c] = (counts[c] || 0) + 1;
        for (const [cmd, n] of Object.entries(counts)) {
            if (n >= this.LOOP_THRESHOLD) return cmd;
        }
        return null;
    },

    // Called once per line-set the terminal prints for a submitted command.
    onCommand(raw, outLines) {
        if (!window.MENTORMODE || !window.MENTORMODE.enabled) return;
        if (window.MODES && !window.MODES.assistAllowed()) return;
        if (!window.GAME || !window.SESSION) return;
        if (SESSION.isRoot || SESSION.blueTeam) return;
        const lvl = window.GAME.level && window.GAME.level();
        if (!lvl) return;

        this.log.push(raw);
        const cmds = SESSION.cmdCount || 0;
        const meta = (window.MACHINE_META && window.MACHINE_META[window.GAME.currentLevel]) || {};
        const cat = meta.cat;
        const errored = (outLines || []).some(l => l && l.cls === 'err');

        if (!this.reconSeenAt) {
            const pattern = this.RECON_PATTERNS[cat];
            if (pattern && pattern.test(raw)) this.reconSeenAt = cmds;
        }

        // Error-streak bookkeeping happens on every call, regardless of the
        // rate limit below — otherwise a streak spanning a rate-limited
        // window would never be counted (only the *nudge itself* should be
        // throttled, not the observation feeding it).
        this._errStreak = errored ? (this._errStreak || 0) + 1 : 0;
        this.observePaths(raw);

        // Rate limit: never more than one nudge per MIN_GAP commands.
        if (cmds - this.lastNudgeAt < this.MIN_GAP) return;

        // Rule 1 — three-in-a-row failures: a light word of encouragement.
        if (this._errStreak >= 3 && !this.fired.has('errors')) {
            this.say(this.errorStreakLine());
            this.fired.add('errors');
            this.lastNudgeAt = cmds;
            return;
        }

        // Rule 2 — the same command over and over. The most common way to be
        // stuck is not "no idea what to do", it's re-running the last thing
        // that worked hoping for a different answer.
        const looping = this.loopingCommand();
        if (looping && !this.fired.has('loop')) {
            this.say(this.loopLine(looping));
            this.fired.add('loop');
            this.lastNudgeAt = cmds;
            return;
        }

        // Rule 3 — recon not attempted yet after a while.
        if (!this.reconSeenAt && cmds >= this.at(this.RECON_THRESHOLD) && !this.fired.has('recon')) {
            this.say(this.reconLine(cat));
            this.fired.add('recon');
            this.lastNudgeAt = cmds;
            return;
        }

        // Rule 4 — found the vector, keeps re-reading it, never runs it. The
        // second most common way to be stuck, and the one hints answer worst.
        const idle = this.idleFind();
        if (idle && this.reconSeenAt && (cmds - this.reconSeenAt) >= this.at(this.IDLE_THRESHOLD) && !this.fired.has('idle')) {
            this.say(this.idleFindLine(idle));
            this.fired.add('idle');
            this.lastNudgeAt = cmds;
            return;
        }

        // Rule 5 — recon happened, but no root a while after.
        if (this.reconSeenAt && (cmds - this.reconSeenAt) >= this.at(this.STUCK_THRESHOLD) && !this.fired.has('stuck')) {
            this.say(this.stuckLine());
            this.fired.add('stuck');
            this.lastNudgeAt = cmds;
            return;
        }

        // Rule 6 — last resort, only once, points at the existing hint system.
        if (cmds >= this.at(this.LOST_THRESHOLD) && !this.fired.has('lost')) {
            this.say(this.lostLine());
            this.fired.add('lost');
            this.lastNudgeAt = cmds;
        }
    },

    say(msg) {
        if (!window.TERM || !msg) return;
        const text = msg[window.currentLang] || msg.en;
        window.TERM.print([
            { text: '', cls: '' },
            { text: '🧭 ' + text, cls: 'mentor' }
        ]);
        window.TERM.scrollToBottom && window.TERM.scrollToBottom();
    }
};

// Hook into the single command entry point, same pattern as the cron hook
// at the bottom of commands.js — never changes CMD.execute's return value,
// only observes it.
if (window.CMD && window.CMD.execute) {
    const _origExecute = window.CMD.execute.bind(window.CMD);
    window.CMD.execute = function(raw) {
        const out = _origExecute(raw);
        try { window.MENTOR.onCommand(raw, out); } catch (e) { /* coaching is best-effort, never breaks the game */ }
        return out;
    };
}
