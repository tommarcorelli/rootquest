// story.js — "Campaign" mode (📖): OPERATION HOLLOW ROOT.
//
// Every other mode changes the *rules*; the campaign changes the *frame*. It
// threads a handful of the lab's existing machines onto a single narrative
// spine — a freelance operator, a handler who is not what they claim, and a
// data-broker called NULLCORP — so a run of boxes reads as one job with a
// beginning and a twist instead of a grid of unrelated puzzles.
//
// It owns no exploit logic and changes no gameplay rules: each chapter is a
// briefing before an ordinary box and a debrief after rooting it. That keeps
// the whole thing pure overlay — a chapter is "some dialogue, then box N",
// and box N plays exactly as it does anywhere else. Progress is one integer
// (the furthest chapter reached), persisted, so the campaign resumes where it
// left off across reloads.
window.STORY = {
    KEY: 'rootquest_story',
    HANDLER: '0xMORPH',

    active: false,
    chapter: 0,     // index into CHAPTERS currently being played
    reached: 0,     // furthest chapter unlocked (persisted)
    ending: null,   // 'burn' | 'ghost' | 'crown' — the branch chosen at Ch.6 (persisted)

    // Each chapter: the box it wraps, plus the handler's briefing (before) and
    // debrief (after). `final` flips the last one into the reveal. All prose
    // trilingual — this is the content the mode exists to deliver.
    CHAPTERS: [
        {
            boxId: 1,
            title: { en: 'Ch.1 — Foothold', fr: 'Ch.1 — Point d\'entrée', es: 'Cap.1 — Punto de entrada' },
            intro: {
                en: `>> ${'0xMORPH'} // secure channel open\n"You're the freelancer everyone's too scared to hire. Good. NULLCORP runs a jump host they think nobody's watching — one forgotten SUID binary from a 2019 image. Get on it, get root, prove you're worth the rate. Don't leave a mess."`,
                fr: `>> 0xMORPH // canal sécurisé ouvert\n« Tu es le freelance que tout le monde a trop peur d'embaucher. Parfait. NULLCORP a un jump host qu'ils croient invisible — un binaire SUID oublié d'une image de 2019. Monte dessus, passe root, prouve que tu vaux ton tarif. Ne laisse pas de traces. »`,
                es: `>> 0xMORPH // canal seguro abierto\n«Eres el freelance que todos tienen demasiado miedo de contratar. Perfecto. NULLCORP tiene un jump host que creen invisible — un binario SUID olvidado de una imagen de 2019. Entra, consigue root, demuestra que vales tu tarifa. No dejes rastro.»`
            },
            outro: {
                en: `"Clean. The jump host was just the doorbell — behind it there's a whole estate. Payment's in escrow. Stay by the channel."`,
                fr: `« Propre. Le jump host n'était que la sonnette — derrière, c'est tout un domaine. Le paiement est sous séquestre. Reste près du canal. »`,
                es: `«Limpio. El jump host solo era el timbre — detrás hay toda una finca. El pago está en depósito. Quédate cerca del canal.»`
            }
        },
        {
            boxId: 3,
            title: { en: 'Ch.2 — The Pipeline', fr: 'Ch.2 — Le pipeline', es: 'Cap.2 — El pipeline' },
            intro: {
                en: `"Their build server signs every internal tool. Whoever owns it owns what NULLCORP trusts. It doesn't lean on SUID — look at what capabilities got handed to the wrong binary. Own the pipeline, quietly."`,
                fr: `« Leur serveur de build signe chaque outil interne. Qui le possède possède ce en quoi NULLCORP a confiance. Ça ne repose pas sur le SUID — regarde quelles capabilities ont atterri sur le mauvais binaire. Prends le pipeline, discrètement. »`,
                es: `«Su servidor de build firma cada herramienta interna. Quien lo posee posee aquello en lo que NULLCORP confía. No depende de SUID — mira qué capabilities acabaron en el binario equivocado. Toma el pipeline, en silencio.»`
            },
            outro: {
                en: `"Now their toolchain answers to us. I'm seeing shipping manifests you shouldn't move this quietly. Keep going — I want to know what they're moving."`,
                fr: `« Maintenant leur chaîne d'outils nous obéit. Je vois des manifestes d'expédition qu'on ne déplace pas si discrètement. Continue — je veux savoir ce qu'ils transportent. »`,
                es: `«Ahora su cadena de herramientas nos obedece. Veo manifiestos de envío que no se mueven tan en silencio. Sigue — quiero saber qué transportan.»`
            }
        },
        {
            boxId: 6,
            title: { en: 'Ch.3 — Identity Store', fr: 'Ch.3 — Le magasin d\'identités', es: 'Cap.3 — El almacén de identidades' },
            intro: {
                en: `"The identity store maps every NULLCORP employee to every system. Somebody left the account file writable. Add yourself, become anyone. I need a name that opens doors on the inside."`,
                fr: `« Le magasin d'identités relie chaque employé NULLCORP à chaque système. Quelqu'un a laissé le fichier des comptes accessible en écriture. Ajoute-toi, deviens n'importe qui. J'ai besoin d'un nom qui ouvre les portes à l'intérieur. »`,
                es: `«El almacén de identidades vincula a cada empleado de NULLCORP con cada sistema. Alguien dejó el archivo de cuentas escribible. Añádete, conviértete en cualquiera. Necesito un nombre que abra puertas dentro.»`
            },
            outro: {
                en: `"You're on the org chart now — a director who never existed. Funny thing: the store already had three identities like that, all created last month. Someone else is doing exactly what we're doing."`,
                fr: `« Tu es sur l'organigramme maintenant — un directeur qui n'a jamais existé. Le plus drôle : le magasin avait déjà trois identités comme ça, toutes créées le mois dernier. Quelqu'un d'autre fait exactement ce qu'on fait. »`,
                es: `«Ahora estás en el organigrama — un director que nunca existió. Lo curioso: el almacén ya tenía tres identidades así, todas creadas el mes pasado. Alguien más hace exactamente lo que hacemos.»`
            }
        },
        {
            boxId: 11,
            title: { en: 'Ch.4 — Ghosts in the Loader', fr: 'Ch.4 — Fantômes dans le loader', es: 'Cap.4 — Fantasmas en el loader' },
            intro: {
                en: `"Those other identities came from a preload backdoor — a library that loads itself into everything privileged on the host. The same trick's available to you here. Use it, and pull whatever the last intruder left behind."`,
                fr: `« Ces autres identités venaient d'une backdoor par préchargement — une bibliothèque qui se charge dans tout ce qui est privilégié sur l'hôte. Le même tour t'est offert ici. Sers-t'en, et récupère ce que le dernier intrus a laissé. »`,
                es: `«Esas otras identidades venían de una backdoor por precarga — una biblioteca que se carga en todo lo privilegiado del host. El mismo truco está disponible aquí. Úsalo y saca lo que dejó el último intruso.»`
            },
            outro: {
                en: `"The library was signed. With the build key you stole in Chapter 2 — before you stole it. That's not possible unless someone knew you'd take it. I need to check something. Keep working."`,
                fr: `« La bibliothèque était signée. Avec la clé de build que tu as volée au chapitre 2 — avant que tu ne la voles. Impossible, à moins que quelqu'un ait su que tu la prendrais. Je dois vérifier un truc. Continue. »`,
                es: `«La biblioteca estaba firmada. Con la clave de build que robaste en el capítulo 2 — antes de robarla. Imposible, salvo que alguien supiera que la tomarías. Tengo que comprobar algo. Sigue trabajando.»`
            }
        },
        {
            boxId: 21,
            title: { en: 'Ch.5 — Beyond Discretion', fr: 'Ch.5 — Au-delà du pouvoir', es: 'Cap.5 — Más allá de lo discrecional' },
            intro: {
                en: `"NULLCORP's vault index sits behind a capability most admins don't even know can read past permissions. I'm quiet because I'm reading what you already pulled. The index has a name at the top of every access log. Get in and read it yourself."`,
                fr: `« L'index du coffre de NULLCORP est protégé par une capability que la plupart des admins ignorent capable de lire au-delà des permissions. Je suis silencieux parce que je lis ce que tu as déjà extrait. L'index a un nom en tête de chaque log d'accès. Entre et lis-le toi-même. »`,
                es: `«El índice de la bóveda de NULLCORP está tras una capability que la mayoría de admins ni saben que puede leer más allá de los permisos. Callo porque estoy leyendo lo que ya sacaste. El índice tiene un nombre al principio de cada log de acceso. Entra y léelo tú mismo.»`
            },
            outro: {
                en: `"You read it. Every extraction from that vault for two years signed off by one operator. Mine. 0xMORPH isn't a handler — it's the account NULLCORP uses to rob itself and blame ghosts. And now it's yours, wearing your face."`,
                fr: `« Tu l'as lu. Chaque extraction de ce coffre depuis deux ans validée par un seul opérateur. Le mien. 0xMORPH n'est pas un handler — c'est le compte que NULLCORP utilise pour se voler et accuser des fantômes. Et maintenant il est à toi, avec ton visage. »`,
                es: `«Lo leíste. Cada extracción de esa bóveda durante dos años firmada por un solo operador. El mío. 0xMORPH no es un handler — es la cuenta que NULLCORP usa para robarse a sí misma y culpar a fantasmas. Y ahora es tuya, con tu cara.»`
            }
        },
        {
            boxId: 27,
            title: { en: 'Ch.6 — Override', fr: 'Ch.6 — Override', es: 'Cap.6 — Override' },
            intro: {
                en: `"Whoever runs 0xMORPH is closing the frame — on you. The logging host has a capability that lets you rewrite what it thinks happened. This is the only chapter I'll tell you to be loud: overwrite the trail before it's the only version left. Override it."`,
                fr: `« Celui qui pilote 0xMORPH est en train de refermer le piège — sur toi. L'hôte de journalisation a une capability qui te laisse réécrire ce qu'il croit s'être passé. C'est le seul chapitre où je te dis d'être bruyant : écrase la piste avant qu'elle ne soit la seule version qui reste. Override. »`,
                es: `«Quien maneja 0xMORPH está cerrando el marco — sobre ti. El host de registro tiene una capability que te permite reescribir lo que cree que pasó. Este es el único capítulo donde te digo que hagas ruido: sobrescribe el rastro antes de que sea la única versión que quede. Override.»`
            },
            outro: {
                en: `"The logs say you were never here. Neither was 0xMORPH. One system still holds the truth — the core they built all of this to protect. There's one call left, and it's yours: what do you do with it once you're standing on top?"`,
                fr: `« Les logs disent que tu n'es jamais venu. 0xMORPH non plus. Un seul système détient encore la vérité — le cœur qu'ils ont bâti tout ça pour protéger. Il reste une décision, et elle est à toi : qu'est-ce que tu en fais, une fois au sommet ? »`,
                es: `«Los logs dicen que nunca estuviste aquí. 0xMORPH tampoco. Un solo sistema aún guarda la verdad — el núcleo que construyeron todo esto para proteger. Queda una decisión, y es tuya: ¿qué haces con ella una vez en la cima?»`
            },
            // The one branch point. Whichever you pick is remembered and
            // selects the finale you get in the next chapter.
            choice: {
                prompt: {
                    en: 'How does this end?',
                    fr: 'Comment ça se termine ?',
                    es: '¿Cómo termina esto?'
                },
                options: [
                    { id: 'burn', label: { en: '🔥 Burn NULLCORP down', fr: '🔥 Brûler NULLCORP', es: '🔥 Quemar NULLCORP' } },
                    { id: 'ghost', label: { en: '👻 Erase yourself and vanish', fr: '👻 T\'effacer et disparaître', es: '👻 Borrarte y desaparecer' } },
                    { id: 'crown', label: { en: '👑 Take 0xMORPH\'s throne', fr: '👑 Prendre le trône de 0xMORPH', es: '👑 Tomar el trono de 0xMORPH' } }
                ]
            }
        },
        {
            boxId: 38,
            final: true,
            title: { en: 'Ch.7 — Hollow Root', fr: 'Ch.7 — Racine creuse', es: 'Cap.7 — Raíz hueca' },
            intro: {
                en: `"The core. Its build system trusts an inline rule the way NULLCORP trusted 0xMORPH — completely, and for no good reason. Feed it a shell. Whatever's at the top of this company, you're about to be standing on it. Last briefing. Make it count."`,
                fr: `« Le cœur. Son système de build fait confiance à une règle en ligne comme NULLCORP faisait confiance à 0xMORPH — totalement, et sans raison. Donne-lui un shell. Quoi qu'il y ait au sommet de cette boîte, tu vas te tenir dessus. Dernier briefing. Fais que ça compte. »`,
                es: `«El núcleo. Su sistema de build confía en una regla en línea como NULLCORP confiaba en 0xMORPH — por completo, y sin razón. Dale un shell. Sea lo que sea la cima de esta empresa, estás a punto de pisarla. Último briefing. Que cuente.»`
            },
            // Fallback if somehow no choice was recorded (e.g. a save from
            // before the branch existed). endingText() prefers `endings`.
            outro: {
                en: `>> CORE ROOTED // channel 0xMORPH terminated by peer\n"There was never a client, never a handler you could trust. There was you, a company that eats its own, and a name it pinned every theft on. Hollow root. Log off. You were never here."`,
                fr: `>> CŒUR ROOTÉ // canal 0xMORPH terminé par le pair\n« Il n'y a jamais eu de client, jamais de handler digne de confiance. Il y avait toi, une boîte qui se dévore, et un nom sur lequel elle épinglait chaque vol. Racine creuse. Déconnecte. Tu n'as jamais été là. »`,
                es: `>> NÚCLEO ROOTEADO // canal 0xMORPH terminado por el par\n«Nunca hubo un cliente, nunca un handler de fiar. Estabas tú, una empresa que se devora, y un nombre al que le colgaba cada robo. Raíz hueca. Desconéctate. Nunca estuviste aquí.»`
            },
            endings: {
                burn: {
                    en: `>> CORE ROOTED // detonating\n"You push the whole archive — every theft NULLCORP blamed on ghosts — to every regulator, journalist and rival at once, signed with their own build key. By morning there is no NULLCORP, only the smoking record of what it did. 0xMORPH was a mask the company wore to rob itself; you set the mask on fire with the face still inside. You don't get paid. You get to watch it burn. Log off."`,
                    fr: `>> CŒUR ROOTÉ // détonation\n« Tu balances toute l'archive — chaque vol que NULLCORP a mis sur le dos de fantômes — à tous les régulateurs, journalistes et rivaux d'un coup, signée avec leur propre clé de build. Au matin il n'y a plus de NULLCORP, juste le dossier fumant de ce qu'elle a fait. 0xMORPH était un masque que la boîte portait pour se voler ; tu as mis le feu au masque, le visage encore dedans. Tu n'es pas payé. Tu regardes brûler. Déconnecte. »`,
                    es: `>> NÚCLEO ROOTEADO // detonando\n«Envías todo el archivo — cada robo que NULLCORP culpó a fantasmas — a todos los reguladores, periodistas y rivales a la vez, firmado con su propia clave de build. Al amanecer no hay NULLCORP, solo el expediente humeante de lo que hizo. 0xMORPH era una máscara que la empresa usaba para robarse; le prendiste fuego con la cara aún dentro. No cobras. Miras arder. Desconéctate.»`
                },
                ghost: {
                    en: `>> CORE ROOTED // scrubbing\n"You don't take anything. You take yourself out — every log, every identity, the whole shape of the operator called 0xMORPH, deleted from the inside until the frame has no one left to hang. NULLCORP keeps eating itself in the dark, none the wiser, and the ghost it invented finally stops existing. No payment, no proof, no trace. The cleanest exit is the one where you were never a story at all. Log off."`,
                    fr: `>> CŒUR ROOTÉ // effacement\n« Tu ne prends rien. Tu te retires — chaque log, chaque identité, toute la forme de l'opérateur nommé 0xMORPH, effacée de l'intérieur jusqu'à ce que le piège n'ait plus personne à accrocher. NULLCORP continue de se dévorer dans le noir, sans rien savoir, et le fantôme qu'elle a inventé cesse enfin d'exister. Pas de paiement, pas de preuve, pas de trace. La sortie la plus propre est celle où tu n'as jamais été une histoire. Déconnecte. »`,
                    es: `>> NÚCLEO ROOTEADO // borrando\n«No te llevas nada. Te sacas a ti mismo — cada log, cada identidad, toda la forma del operador llamado 0xMORPH, borrada desde dentro hasta que el marco no tiene a nadie de quien colgar. NULLCORP sigue devorándose en la oscuridad, sin enterarse, y el fantasma que inventó por fin deja de existir. Sin pago, sin prueba, sin rastro. La salida más limpia es aquella en la que nunca fuiste una historia. Desconéctate.»`
                },
                crown: {
                    en: `>> CORE ROOTED // access transferred\n"You don't burn it and you don't vanish. You keep it. 0xMORPH was the account that owned everything and answered to no one — and now it wears your face because you put it there. NULLCORP goes on robbing itself, except every ghost it blames now works for you, and every extraction signs off in your name. You came in a freelancer nobody would hire. You leave as the thing the whole company was built to feed. Hollow root, and you're sitting in it. Log off."`,
                    fr: `>> CŒUR ROOTÉ // accès transféré\n« Tu ne brûles rien et tu ne disparais pas. Tu gardes. 0xMORPH était le compte qui possédait tout et ne rendait de comptes à personne — et maintenant il porte ton visage parce que c'est toi qui l'y as mis. NULLCORP continue de se voler, sauf que chaque fantôme qu'elle accuse travaille désormais pour toi, et chaque extraction est validée en ton nom. Tu es arrivé freelance que personne n'embauchait. Tu repars comme la chose que toute la boîte a été bâtie pour nourrir. Racine creuse, et tu es assis dedans. Déconnecte. »`,
                    es: `>> NÚCLEO ROOTEADO // acceso transferido\n«Ni lo quemas ni desapareces. Te lo quedas. 0xMORPH era la cuenta que lo poseía todo y no respondía ante nadie — y ahora lleva tu cara porque tú la pusiste ahí. NULLCORP sigue robándose, salvo que cada fantasma al que culpa ahora trabaja para ti, y cada extracción se firma en tu nombre. Entraste como freelance que nadie contrataba. Sales como aquello que toda la empresa fue construida para alimentar. Raíz hueca, y estás sentado en ella. Desconéctate.»`
                }
            }
        }
    ],

    init() {
        this.reached = 0; this.ending = null;
        try {
            const raw = localStorage.getItem(this.KEY);
            if (raw != null) {
                // v1.40 stored a bare integer; v1.41 stores { reached, ending }.
                // A leading digit means the old format — read it as reached.
                if (/^\d+$/.test(raw.trim())) this.reached = parseInt(raw, 10) || 0;
                else {
                    const o = JSON.parse(raw);
                    this.reached = Math.max(0, o.reached || 0);
                    this.ending = o.ending || null;
                }
            }
        } catch (e) { this.reached = 0; this.ending = null; }
        if (this.reached > this.CHAPTERS.length) this.reached = this.CHAPTERS.length;
    },

    persist() {
        try { localStorage.setItem(this.KEY, JSON.stringify({ reached: this.reached, ending: this.ending })); }
        catch (e) { /* ignore */ }
    },

    // Records the branch chosen at the Ch.6 debrief.
    choose(id) {
        this.ending = id;
        this.persist();
    },

    // The finale's outro, selected by the recorded choice. Falls back to the
    // base `outro` if no branch was taken (e.g. a pre-branch save).
    endingText(ch) {
        if (ch.endings && this.ending && ch.endings[this.ending]) return ch.endings[this.ending];
        return ch.outro;
    },

    complete() { return this.reached >= this.CHAPTERS.length; },
    current() { return this.CHAPTERS[this.chapter] || null; },
    chapterForBox(boxId) { return this.CHAPTERS.findIndex(c => c.boxId === boxId); },

    // The chapter to resume at: the first not yet cleared, or the last if the
    // whole campaign is done (replaying the finale).
    resumeIndex() {
        return Math.min(this.reached, this.CHAPTERS.length - 1);
    },

    text(obj) { return (obj && (obj[window.currentLang] || obj.en)) || ''; },

    // Marks the current chapter cleared when its box is rooted. Returns true if
    // this actually advanced the campaign (so the caller shows the debrief).
    onBoxRooted(boxId) {
        if (!this.active) return false;
        const ch = this.current();
        if (!ch || ch.boxId !== boxId) return false;
        if (this.chapter + 1 > this.reached) { this.reached = this.chapter + 1; this.persist(); }
        return true;
    }
};
