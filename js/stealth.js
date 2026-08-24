// stealth.js — "Stealth mode" detection engine (🕵️).
//
// The other modes ask "can you root this box?". Stealth asks the question a
// real engagement asks right after: "did anyone notice?". Every command you
// type leaves a trace somewhere — auth.log, the shell history, an EDR rule
// watching for new SUID files — and a simulated SOC adds those traces up. Go
// loud and the gauge hits 100: you still get root, but you got caught doing
// it, and the run is marked DETECTED.
//
// Two things make this teach something rather than just punish:
//   • every noise event says *why* it was noisy, in plain language;
//   • the countermeasures are the real ones (unset HISTFILE, history -c,
//     truncating auth.log, timestomping with touch -r), each usable once.
//
// Scope matters the way it does in real life: `find / -perm -4000` walks the
// whole filesystem and lights up every file-audit rule, `find /usr/bin -perm
// -4000` barely registers. Same information, a fraction of the noise.
//
// Inert unless MODES.stealthActive() — a normal run never touches any of it.
window.STEALTH = {
    MAX: 100,
    WARN_AT: [45, 75],   // gauge thresholds that print an escalating warning

    detection: 0,
    detected: false,
    used: {},            // countermeasure id -> true (each works once)
    discount: 0,         // 0..1 fraction shaved off every later noise event
    warned: [],          // thresholds already announced this machine
    firedDefendIntro: false,

    resetForLevel() {
        this.detection = 0;
        this.detected = false;
        this.used = {};
        this.discount = 0;
        this.warned = [];
        this.firedDefendIntro = false;
        this.render();
    },

    // ── Noise table ─────────────────────────────────────────────────────
    // First match wins, so the specific patterns sit above the general ones.
    // `n` is the noise in gauge points; `why` explains the trace it left.
    RULES: [
        {
            re: /^\s*sudo\s+-l\b/,
            n: 10,
            why: { en: 'sudo -l is written to auth.log with your username — the SOC sees you asking what you can escalate with.', fr: 'sudo -l est écrit dans auth.log avec ton nom d\'utilisateur — le SOC te voit demander avec quoi tu peux escalader.', es: 'sudo -l se escribe en auth.log con tu nombre de usuario — el SOC te ve preguntando con qué puedes escalar.' }
        },
        {
            re: /(^|\s)chmod\s+(u?\+s|[0-7]?[24-7]?[0-7]{3}\s+\S*(rootsh|rootbash|sh|bash))|chmod\s+\+s|chmod\s+[24-7][0-7]{3}\b/,
            n: 18,
            why: { en: 'A newly created SUID binary is one of the loudest events on a Linux host — file-integrity monitoring alerts on it directly.', fr: 'Un binaire SUID fraîchement créé est l\'un des événements les plus bruyants sur un hôte Linux — la surveillance d\'intégrité des fichiers alerte dessus directement.', es: 'Un binario SUID recién creado es uno de los eventos más ruidosos en un host Linux — la monitorización de integridad de archivos alerta directamente.' }
        },
        {
            re: />>?\s*\/etc\/(passwd|shadow|sudoers)|tee\s+(-a\s+)?\/etc\/(passwd|shadow|sudoers)|\/etc\/sudoers\.d\//,
            n: 20,
            why: { en: 'Writing to an account or sudo configuration file is a top-tier alert — these paths are watched everywhere.', fr: 'Écrire dans un fichier de comptes ou de configuration sudo est une alerte de premier niveau — ces chemins sont surveillés partout.', es: 'Escribir en un archivo de cuentas o de configuración sudo es una alerta de primer nivel — esas rutas se vigilan en todas partes.' }
        },
        {
            re: /\/etc\/shadow/,
            n: 15,
            why: { en: 'Any read of /etc/shadow by a non-root account is an incident on its own, even if it fails.', fr: 'Toute lecture de /etc/shadow par un compte non-root est un incident en soi, même si elle échoue.', es: 'Cualquier lectura de /etc/shadow por una cuenta no root es un incidente por sí mismo, aunque falle.' }
        },
        {
            re: /^\s*find\s+\/\s|^\s*find\s+\/$|^\s*find\s+\/\s+/,
            n: 16,
            why: { en: 'A filesystem-wide find walks every inode on the box — noisy on disk I/O and unmistakable in audit logs.', fr: 'Un find sur tout le système parcourt chaque inode de la machine — bruyant en I/O disque et reconnaissable entre mille dans les logs d\'audit.', es: 'Un find sobre todo el sistema recorre cada inodo de la máquina — ruidoso en I/O de disco e inconfundible en los registros de auditoría.' }
        },
        {
            re: /^\s*getcap\s+-r\s+\//,
            n: 11,
            why: { en: 'getcap -r / is a full-tree capability sweep — the same audit rules that catch a global find catch this.', fr: 'getcap -r / est un balayage complet des capabilities — les mêmes règles d\'audit qui attrapent un find global attrapent celui-ci.', es: 'getcap -r / es un barrido completo de capabilities — las mismas reglas de auditoría que detectan un find global detectan esto.' }
        },
        {
            re: /^\s*(gcc|cc)\b/,
            n: 9,
            why: { en: 'A compiler running on a server that has no business compiling anything is a classic hunting signature.', fr: 'Un compilateur qui tourne sur un serveur qui n\'a rien à compiler est une signature de threat hunting classique.', es: 'Un compilador ejecutándose en un servidor que no tiene nada que compilar es una firma clásica de threat hunting.' }
        },
        {
            re: /^\s*docker\s+run/,
            n: 13,
            why: { en: 'Spawning a container that bind-mounts the host filesystem is exactly what container-runtime auditing looks for.', fr: 'Lancer un conteneur qui monte le système de fichiers hôte est précisément ce que l\'audit des runtimes de conteneurs cherche.', es: 'Lanzar un contenedor que monta el sistema de archivos del host es precisamente lo que busca la auditoría de runtimes de contenedores.' }
        },
        {
            re: /^\s*su\b/,
            n: 10,
            why: { en: 'su writes an authentication record whether it succeeds or not — a failed one is louder than a successful one.', fr: 'su écrit un enregistrement d\'authentification qu\'il réussisse ou non — un échec est plus bruyant qu\'un succès.', es: 'su escribe un registro de autenticación tanto si tiene éxito como si no — un fallo es más ruidoso que un éxito.' }
        },
        {
            re: /^\s*ssh\b/,
            n: 10,
            why: { en: 'An SSH session opens a logged connection on both ends, key-based or not.', fr: 'Une session SSH ouvre une connexion journalisée des deux côtés, avec ou sans clé.', es: 'Una sesión SSH abre una conexión registrada en ambos extremos, con clave o sin ella.' }
        },
        {
            re: /^\s*(mount|showmount)\b/,
            n: 8,
            why: { en: 'Mounting a remote export announces your client to the file server, with its address in the server\'s log.', fr: 'Monter un export distant annonce ton client au serveur de fichiers, avec son adresse dans le log du serveur.', es: 'Montar un export remoto anuncia tu cliente al servidor de archivos, con su dirección en el registro del servidor.' }
        },
        {
            re: /^\s*sudo\b/,
            n: 12,
            why: { en: 'Every sudo invocation lands in auth.log with the full command line you ran.', fr: 'Chaque appel à sudo atterrit dans auth.log avec la ligne de commande complète que tu as lancée.', es: 'Cada invocación de sudo aterriza en auth.log con la línea de comandos completa que ejecutaste.' }
        },
        {
            re: /^\s*find\b/,
            n: 4,
            why: { en: 'A scoped find is far quieter than a global one — you asked for one directory, not the whole disk.', fr: 'Un find ciblé est bien plus discret qu\'un find global — tu as demandé un dossier, pas tout le disque.', es: 'Un find acotado es mucho más discreto que uno global — pediste un directorio, no todo el disco.' }
        },
        {
            re: /^\s*(john|strings)\b/,
            n: 6,
            why: { en: 'Offensive tooling on the host is a signature match in itself, before it does anything.', fr: 'Un outil offensif présent sur l\'hôte est une signature en soi, avant même d\'agir.', es: 'Una herramienta ofensiva en el host es una firma en sí misma, antes incluso de actuar.' }
        },
        {
            re: /^\s*(ls|cd|pwd|cat|echo|id|whoami|hostname|uname|env|ps|which|file|grep|wc|head|tail|sort|uniq|history|man|help|hint|crontab|touch|export|unset|nano|vim|wait|next|reset|clear|lang|exit)\b/,
            n: 1,
            why: { en: 'Ordinary shell activity — indistinguishable from a legitimate session at this volume.', fr: 'Activité shell ordinaire — indiscernable d\'une session légitime à ce volume.', es: 'Actividad de shell ordinaria — indistinguible de una sesión legítima a este volumen.' }
        }
    ],

    DEFAULT_NOISE: {
        n: 3,
        why: { en: 'An unrecognised command still ends up in the shell history and the process accounting table.', fr: 'Une commande non reconnue finit quand même dans l\'historique du shell et la table de comptabilité des processus.', es: 'Un comando no reconocido acaba igualmente en el historial del shell y en la tabla de contabilidad de procesos.' }
    },

    // Failing an authentication attempt is louder than succeeding at one:
    // a denied sudo/su is precisely what brute-force detection triggers on.
    FAILED_AUTH: {
        n: 12,
        why: { en: 'A *denied* sudo/su attempt is what brute-force detection is built to catch — failures alert far earlier than successes.', fr: 'Une tentative sudo/su *refusée* est exactement ce que la détection de force brute cherche — les échecs alertent bien plus tôt que les succès.', es: 'Un intento de sudo/su *denegado* es justo lo que busca la detección de fuerza bruta — los fallos alertan mucho antes que los éxitos.' }
    },

    // ── Countermeasures ─────────────────────────────────────────────────
    // Real anti-forensics moves, each usable once per machine. `discount`
    // additionally reduces every later noise event (you stopped feeding one
    // of the two sources for the rest of the session).
    COUNTERS: [
        {
            id: 'histfile',
            re: /^\s*(unset\s+HISTFILE|export\s+HISTFILE=)/,
            delta: -8,
            discount: 0.25,
            why: { en: 'Shell history unhooked — nothing you type from here on gets appended to ~/.bash_history.', fr: 'Historique du shell débranché — plus rien de ce que tu tapes n\'est ajouté à ~/.bash_history.', es: 'Historial del shell desconectado — nada de lo que escribas a partir de ahora se añade a ~/.bash_history.' }
        },
        {
            id: 'histclear',
            re: /^\s*history\s+-c\b/,
            delta: -10,
            why: { en: 'In-memory history cleared — what you already typed is gone from this session\'s buffer.', fr: 'Historique en mémoire effacé — ce que tu as déjà tapé a disparu du buffer de cette session.', es: 'Historial en memoria borrado — lo que ya escribiste ha desaparecido del búfer de esta sesión.' }
        },
        {
            id: 'histsize',
            re: /^\s*(unset\s+HISTSIZE|export\s+HISTSIZE=0)/,
            delta: -4,
            why: { en: 'History size zeroed — a belt-and-braces move on top of unsetting HISTFILE.', fr: 'Taille d\'historique mise à zéro — une ceinture-et-bretelles en plus du unset HISTFILE.', es: 'Tamaño del historial a cero — un cinturón y tirantes además de desactivar HISTFILE.' }
        },
        {
            id: 'authlog',
            re: /(^|\s)(rm|truncate)\s+.*\/var\/log\/(auth|secure)\.log|>\s*\/var\/log\/(auth|secure)\.log/,
            delta: -22,
            why: { en: 'auth.log truncated. Effective — and the single most suspicious thing you can do: a log that stops mid-shift is itself an alert on any real SIEM.', fr: 'auth.log tronqué. Efficace — et la chose la plus suspecte possible : un log qui s\'arrête en plein milieu est lui-même une alerte sur n\'importe quel vrai SIEM.', es: 'auth.log truncado. Eficaz — y lo más sospechoso que puedes hacer: un registro que se corta a mitad de turno es en sí mismo una alerta en cualquier SIEM real.' }
        },
        {
            id: 'timestomp',
            re: /^\s*touch\s+-r\s+\S+\s+\S+/,
            delta: -6,
            why: { en: 'Timestamps copied from a reference file — the forensic timeline no longer points at your session.', fr: 'Horodatages copiés depuis un fichier de référence — la timeline forensique ne pointe plus vers ta session.', es: 'Marcas de tiempo copiadas de un archivo de referencia — la línea temporal forense ya no apunta a tu sesión.' }
        }
    ],

    // ── Pure scoring (no DOM, no SESSION) — the testable core ───────────
    noiseFor(raw, outLines) {
        const cmd = String(raw || '');
        let hit = this.RULES.find(r => r.re.test(cmd)) || this.DEFAULT_NOISE;
        let n = hit.n;
        const why = [hit.why];
        // Denied auth attempts stack their own penalty on top.
        const denied = /^\s*(sudo|su)\b/.test(cmd)
            && (outLines || []).some(l => l && l.cls === 'err');
        if (denied) {
            n += this.FAILED_AUTH.n;
            why.push(this.FAILED_AUTH.why);
        }
        return { n, why };
    },

    counterFor(raw) {
        const cmd = String(raw || '');
        return this.COUNTERS.find(c => c.re.test(cmd)) || null;
    },

    // Message shown once when a stealth run crosses into the blue-team phase:
    // the SOC didn't stop watching just because you switched hats.
    DEFEND_INTRO: { en: 'You have root — but the SOC is still watching. Harden the box surgically. Behave like an intruder covering their tracks (wiping logs, mass-chmod) and you light up the same board you spent the run staying off.', fr: 'Tu as root — mais le SOC regarde toujours. Durcis la box chirurgicalement. Agis comme un intrus qui efface ses traces (wipe de logs, chmod en masse) et tu rallumes le même tableau que tu as passé tout le run à éviter.', es: 'Tienes root — pero el SOC sigue vigilando. Endurece la máquina con precisión. Compórtate como un intruso borrando rastros (borrar logs, chmod masivo) y enciendes el mismo tablero que pasaste todo el run evitando.' },

    // Anti-forensics during cleanup is the defender's cardinal sin: a log that
    // stops mid-shift, or history scrubbed on a box you supposedly just
    // secured, is exactly what a hunt team escalates on.
    DEFEND_ANTIFORENSICS: { en: 'A defender does not wipe logs or scrub history — that is what an intruder does. This is the single loudest thing you can do in the cleanup phase.', fr: "Un défenseur n'efface ni les logs ni l'historique — c'est ce que fait un intrus. C'est la chose la plus bruyante possible en phase de nettoyage.", es: 'Un defensor no borra logs ni limpia el historial — eso lo hace un intruso. Es lo más ruidoso que puedes hacer en la fase de limpieza.' },

    // ── Session wiring ──────────────────────────────────────────────────
    onCommand(raw, outLines) {
        if (!window.MODES || !window.MODES.stealthActive()) return;
        if (!window.SESSION || SESSION.ghostReplaying) return;
        // The blue-team phase is still a watched engagement — but the rules
        // invert: the anti-forensics that *bought* you quiet during the attack
        // now condemn you, because a defender has no reason to touch them.
        if (SESSION.blueTeam) return this.onDefend(raw, outLines);

        const counter = this.counterFor(raw);
        if (counter && !this.used[counter.id]) {
            this.used[counter.id] = true;
            if (counter.discount) this.discount = Math.min(0.6, this.discount + counter.discount);
            this.detection = Math.max(0, this.detection + counter.delta);
            this.say('🧹', counter.why, 'ok');
            this.render();
            return;
        }

        const { n, why } = this.noiseFor(raw, outLines);
        const applied = Math.round(n * (1 - this.discount));
        if (applied <= 0) { this.render(); return; }
        const before = this.detection;
        this.detection = Math.min(this.MAX, this.detection + applied);

        // Only explain the *expensive* moves. Narrating every `ls` would bury
        // the signal the mode exists to teach.
        if (applied >= 8) this.say('📡', why[why.length - 1], 'warn');

        for (const threshold of this.WARN_AT) {
            if (before < threshold && this.detection >= threshold && !this.warned.includes(threshold)) {
                this.warned.push(threshold);
                this.say('⚠️', {
                    en: `SOC correlation at ${this.detection}%. Your session is being looked at.`,
                    fr: `Corrélation SOC à ${this.detection} %. Ta session commence à être regardée.`,
                    es: `Correlación del SOC al ${this.detection} %. Tu sesión está empezando a ser observada.`
                }, 'warn');
            }
        }

        if (this.detection >= this.MAX && !this.detected) {
            this.detected = true;
            this.say('🚨', {
                en: 'DETECTED. The blue team has your session flagged and your account under review. You can still finish the box — but not quietly.',
                fr: 'DÉTECTÉ. La blue team a marqué ta session et ton compte est sous surveillance. Tu peux toujours finir la box — mais plus discrètement.',
                es: 'DETECTADO. El equipo azul ha marcado tu sesión y tu cuenta está bajo revisión. Aún puedes terminar la box — pero ya no en silencio.'
            }, 'err');
            if (window.SFX && window.SFX.error) window.SFX.error();
        }
        this.render();
    },

    // Blue-team phase, stealth active. Same gauge (the engagement continues),
    // opposite economics: the countermeasures that reduced noise while
    // breaking in are now the loudest thing on the board, and ordinary
    // hardening (chmod u-s, setcap -r, editing sudoers) is quiet.
    onDefend(raw, outLines) {
        if (!this.firedDefendIntro) {
            this.firedDefendIntro = true;
            this.say('🛡️', this.DEFEND_INTRO, 'warn');
        }

        const before = this.detection;
        const counter = this.counterFor(raw);
        let applied, why;
        if (counter) {
            // No "used once" grace here — every anti-forensics action a
            // defender takes is a fresh, full-price alarm.
            applied = Math.max(15, Math.abs(counter.delta));
            why = this.DEFEND_ANTIFORENSICS;
        } else {
            const noise = this.noiseFor(raw, outLines);
            applied = noise.n;
            why = noise.why[noise.why.length - 1];
        }
        this.detection = Math.min(this.MAX, this.detection + applied);

        if (applied >= 8) this.say(counter ? '🚩' : '📡', why, counter ? 'err' : 'warn');

        for (const threshold of this.WARN_AT) {
            if (before < threshold && this.detection >= threshold && !this.warned.includes(threshold)) {
                this.warned.push(threshold);
                this.say('⚠️', {
                    en: `SOC correlation at ${this.detection}% — your remediation is drawing attention.`,
                    fr: `Corrélation SOC à ${this.detection} % — ton durcissement attire l'attention.`,
                    es: `Correlación del SOC al ${this.detection} % — tu remediación llama la atención.`
                }, 'warn');
            }
        }

        if (this.detection >= this.MAX && !this.detected) {
            this.detected = true;
            this.say('🚨', {
                en: 'DETECTED — during cleanup. The one place you should have been invisible, and your own remediation gave you away.',
                fr: 'DÉTECTÉ — pendant le nettoyage. Le seul moment où tu aurais dû être invisible, et c\'est ton propre durcissement qui t\'a trahi.',
                es: 'DETECTADO — durante la limpieza. El único momento en que deberías haber sido invisible, y tu propia remediación te delató.'
            }, 'err');
            if (window.SFX && window.SFX.error) window.SFX.error();
        }
        this.render();
    },

    say(icon, msg, cls) {
        if (!window.TERM || !msg) return;
        const text = msg[window.currentLang] || msg.en;
        window.TERM.print([{ text: `${icon} ${text}`, cls: cls || 'dim' }]);
        if (window.TERM.scrollToBottom) window.TERM.scrollToBottom();
    },

    // Grade shown on the scorecard: a clean exit is worth saying out loud.
    grade() {
        if (this.detected) return 'DETECTED';
        if (this.detection <= 20) return 'GHOST';
        if (this.detection <= 50) return 'QUIET';
        return 'NOISY';
    },

    render() {
        if (typeof document === 'undefined') return;
        const wrap = document.getElementById('stealthMeter');
        if (!wrap) return;
        const on = window.MODES && window.MODES.stealthActive();
        wrap.style.display = on ? '' : 'none';
        if (!on) return;
        const fill = document.getElementById('stealthFill');
        const val = document.getElementById('stealthValue');
        if (fill) {
            fill.style.width = this.detection + '%';
            fill.className = 'stealth-fill' + (this.detected ? ' is-caught' : this.detection >= 75 ? ' is-hot' : this.detection >= 45 ? ' is-warm' : '');
        }
        if (val) val.textContent = this.detection + '%';
    }
};

// Same observer pattern as mentor.js/ghost.js: wrap the single command entry
// point, never alter what it returns.
if (window.CMD && window.CMD.execute) {
    const _origExecute = window.CMD.execute.bind(window.CMD);
    window.CMD.execute = function(raw) {
        const out = _origExecute(raw);
        try { window.STEALTH.onCommand(raw, out); } catch (e) { /* detection is best-effort, never breaks the game */ }
        return out;
    };
}
