# 🗺️ Fiche de route — rootQuest

Feuille de route des améliorations possibles pour **rootQuest** (jeu de terminal d'escalade de privilèges Linux, 100 % vanilla JS).
Statut actuel : **v1.8 fonctionnelle** — 23 machines en 3 tiers + import/export JSON de box perso (tier « Personnalisées ») + défi du jour/surprends-moi, hub par tiers + scorecard, **profil opérateur + 8 succès**, terminal réaliste (pipes + `grep`/`ps`/`env`/`man`/autocomplétion/`tee`/`john`/`mount`/`showmount`), **mode Blue Team**, **mode explication** (solution commentée pas-à-pas, togglable), **5 thèmes**, **son**, **historique persistant + `Ctrl+R`**, **timer speedrun + meilleurs temps**, **accessibilité clavier/ARIA**, **responsive mobile**, **offline-first** (polices auto-hébergées, zéro dépendance externe), bilingue EN/FR. Tests : harnais Node 35/35 + Playwright, CI GitHub. Déploiement GitHub Pages prêt (à activer une fois).

Légende : 🔴 prioritaire · 🟠 important · 🟢 confort · 💡 idée long terme
Effort : ⚡ rapide (<1 h) · 🔨 moyen · 🏗️ lourd

---

## 1. Persistance & état du jeu

- ✅ 🔴 ⚡ **Sauvegarder la progression en `localStorage`** — *fait.* `GAME.completed` + langue persistés dans `localStorage` (clé `rootquest_save_v1`), restaurés au boot.
- ✅ 🟠 ⚡ **Bouton « Reset progression »** distinct du reset de machine — *fait.* Bouton dédié sur l'écran d'accueil, avec confirmation avant effacement.
- ✅ 🟢 🔨 **Statistiques par machine** — *fait.* Indices utilisés, commandes tapées et temps de résolution sont suivis et affichés dans un **scorecard** de la modale de victoire, avec un score et un rang S/A/B/C (0 indice = rang S doré).

## 2. PWA & offline (alignement avec tes autres projets)

- ✅ 🔴 🔨 **Passer en vraie PWA** — *fait.* `manifest.webmanifest` + `service-worker.js` (cache-first de l'app shell, fallback offline sur `index.html`) + icônes 192/512 (+ maskable) + logo cyberpunk dédié.
- ✅ 🔴 ⚡ **Supprimer la dépendance Google Fonts** — *fait (v1.2).* Polices **auto-hébergées** : `.woff2` (latin + latin-ext) de JetBrains Mono / Orbitron / Space Grotesk dans `assets/fonts/` + `assets/fonts/fonts.css` local, le `<link>` CDN est retiré. Cachées par le service worker (v3) → vrai offline-first, **zéro requête externe** (vérifié : `document.fonts.check` OK, aucune requête gstatic/googleapis).
- ✅ 🟢 ⚡ **Favicon** + `theme-color` + meta description/OpenGraph — *fait.*

## 3. Contenu — nouvelles machines / vulnérabilités

Le moteur gère désormais **22 vecteurs** (5 d'origine + 5 en v1.1 + 5 en v1.2 + 5 en v1.3 + 2 en v1.4). Statut des idées :

- ✅ 🟠 🔨 **Writable `/etc/passwd`** — *fait (box-06).* Ajout d'un root sans mot de passe (`r00t::0:0::/root:/bin/bash`) puis `su r00t`.
- ✅ 🟠 🔨 **`sudo awk` (GTFOBins)** — *fait (box-07).* NOPASSWD sur `awk` → `sudo awk 'BEGIN{system("/bin/sh")}'`.
- ✅ 🟢 🏗️ **Kernel exploit simulé** — *fait (box-08).* PwnKit / CVE-2021-4034 en version pédagogique (`./pwnkit`).
- ✅ 💡 🏗️ **Chaîne multi-étapes** — *fait (box-09).* Creds en clair → pivot `su svc` → `sudo bash` (plusieurs UID).
- ✅ 🟠 🏗️ **Groupe `docker`** — *fait (box-10).* `docker run -v /:/mnt` pour monter l'hôte.
- ✅ 🟠 🔨 **`sudo` avec `LD_PRELOAD` / `env_keep`** — *fait (box-11).* `env_keep+=LD_PRELOAD` + `.so` compilé via `gcc` → `sudo LD_PRELOAD=/tmp/x.so apache2ctl`.
- ✅ 🟠 🔨 **Wildcard injection** — *fait (box-12).* `tar -czf ... *` dans un cron root + fichiers-options `./--checkpoint-action=exec=sh runme.sh`.
- ✅ 🟢 🔨 **Clé SSH root lisible** — *fait (box-13).* Clé privée world-readable dans une sauvegarde → `ssh -i /opt/backup/id_rsa root@localhost`.
- ✅ 🟠 🔨 **`/etc/sudoers.d` modifiable** — *fait (box-14).* Drop-in NOPASSWD écrit par le joueur, parsé par `sudo`.
- ✅ 🟠 🔨 **`/etc/ld.so.preload` modifiable** — *fait (box-15).* Préchargement global d'un `.so` sur tout binaire SUID.
- ✅ 🟢 ⚡ **Box « data-only » GTFOBins** — *fait (v1.3, box-16 à box-20).* `sudo find` (box-16, même binaire que box-01 mais via sudo au lieu de SUID), `sudo env` (box-17), `sudo python3` (box-18), `sudo less` — échappement pager `!/bin/sh` (box-19), et `sudo tee -a /etc/passwd` piloté par pipe (box-20, nécessite le nouveau moteur `tee` + permissions de redirection réelles — cf. §4). `sudo LD_LIBRARY_PATH` reste ouvert (mécanique distincte de `LD_PRELOAD`, pas juste une nouvelle box de données).
- ✅ 🟠 🔨 **`cap_dac_read_search`** (lecture `/etc/shadow` → crack simulé) — *fait (v1.4, box-21).* python3 avec `cap_dac_read_search+ep` contourne les vérifications de lecture DAC ; `open('/etc/shadow').read()` extrait le hash, `john` (nouvelle commande simulée) le « casse », `su root` avec le hash cassé (nouveau chemin `shadow_crack` dans `su()`).
- ✅ 🟠 🔨 **`sudo LD_LIBRARY_PATH`** — *fait (v1.4, box-22).* Mécanique distincte de `LD_PRELOAD` : le binaire cible référence une bibliothèque manquante par son nom exact (`vulnLib` en donnée de niveau) ; planter un `.so` malveillant sous ce nom précis dans le dossier pointé par `LD_LIBRARY_PATH` (et pas n'importe quel `.so`, contrairement à `LD_PRELOAD`) déclenche l'exécution en root.
- ✅ 🟢 🏗️ **NFS `no_root_squash`** — *fait (v1.5, box-23).* `showmount -e` lit les exports déclarés par le niveau (`nfsExports`) ; `mount -t nfs host:/export /mountpoint` valide contre cette liste et pose `SESSION.nfsMount`. Simplification assumée : pas de vraie double arborescence hôte/client — une fois monté, l'export lui-même (`/srv/backups`) devient l'endroit modifiable, `touch`/`chmod` y bypassent les permissions Unix locales et posent `owner: 'root'`, `chmod u+s` y déclare `exploit: 'nfs_no_root_squash'`. Garde-fou vérifié : `touch` sur l'export échoue tant que non monté (nouvelle vérif `canCreateIn`, réutilisée aussi pour resserrer `touch`/`>`/`>>` ailleurs, gap pré-existant comblé au passage).

## 4. Moteur terminal & réalisme du shell

- ✅ 🔴 🔨 **Découpler la logique de « win » des données `levels[].wins`** — *fait.* `spawnShell(true, { type })` vérifie désormais le `type` contre `level.wins[]` via `CMD.winConditionMet()` avant d'accorder root ; les 5 exploits référencent leur type déclaré (`suid_shell_via`, `cron_hijack`, `python_setuid`, `path_hijack`, `sudo_vim_escape`). `wins[]` est la source de vérité : oublier l'entrée ou se tromper de type bloque l'exploit au lieu de planter silencieusement. **v1.1** a poussé le data-driven plus loin : un nœud fs peut déclarer `exploit: '<type>'` (exploit auto-contenu), un **détecteur générique d'évasions sudo GTFOBins** (vim, awk, env, find, bash/sh, less…) pilote le bon type de victoire depuis `level.wins`, et les mécaniques cron/PATH sont dé-hardcodées (chemin lu depuis `wins`, plus de `level.id === 2`). Reste ouvert : un moteur totalement générique qui déduirait *comment* déclencher l'exploit depuis la donnée seule.
- ✅ 🟠 🔨 **Support des pipes (`|`)** — *fait (v1.2).* Pipelines quote-aware `cmd1 | cmd2 | cmd3` avec filtres `grep [-ivc]`, `wc [-l]`, `head`/`tail [-n]`, `sort [-ru]`, `uniq` (cœur partagé `_filter()`, utilisables aussi en autonome).
- ✅ 🟠 ⚡ **Commandes manquantes courantes** — *fait (v1.2).* `ps [aux]`, `env`, `uname -a`, `hostname`, `mount`, `which`, `file`, `history` (+ `touch`, `gcc`, `ssh` pour les nouvelles box). Sortie technique authentique.
- ✅ 🟢 ⚡ **`sudo -l` demande un mot de passe simulé** — *fait.* Première invocation de `sudo -l` par machine affiche `[sudo] password for <user>: ` (flavor line, pas un vrai prompt bloquant — mimique le ticket sudo mis en cache le temps de la session, cf. `SESSION.sudoAuthed`).
- ✅ 🟢 🔨 **Auto-complétion des commandes** — *fait (v1.2).* `Tab` complète le nom de commande (1er token) en plus des chemins (préfixe commun + liste si ambigu).
- ✅ 🟢 ⚡ **`cd -` / `cd` sans argument** — *fait (v1.2).* Sans argument → home, `cd -` → dossier précédent (`SESSION.prevCwd`). `pushd`/`popd` non gérés.
- ✅ 🟢 🔨 **Pages de manuel en jeu** — *fait (v1.2).* `man <commande>` affiche NAME/SYNOPSIS/EXAMPLE bilingue pour ~22 commandes (`CMD.MANPAGES`).
- ✅ 🟢 🔨 **Persistance de l'historique** entre machines (localStorage) + navigation **`Ctrl+R`** (recherche) — *fait (v1.3).* `TERM.history` est sauvegardé dans `rootquest_save_v1` (`cmdHistory`, 300 dernières entrées) et restauré au boot ; `Ctrl+R` ouvre une recherche arrière incrémentale façon bash (`(reverse-i-search)`...`: `), chaque pression suivante remonte au match précédent.
- ✅ 🟢 🔨 **Permissions réelles sur les redirections `>`/`>>`/`tee`** — *fait (v1.3, pour box-20).* Écrire dans un fichier existant que le joueur ne possède pas et ne peut pas modifier échoue désormais avec `Permission denied`, sauf en root ou via un binaire autorisé par `sudo` (`tee` notamment) — corrige un point où n'importe quel `echo >> /etc/passwd` marchait sans égard aux permissions déclarées.

## 5. Internationalisation (i18n)

- ✅ 🟠 🔨 **Traduire la sortie du terminal** — *fait (v1.2), par choix de design.* Règle : la **voix du jeu** est localisée (menu `help`, notes du simulateur `(...)`, nudges `vim`/`python`, coaching `su`/wildcard, exploit invalide) via de nouvelles clés i18n ; les **sorties verbatim d'outils/OS** (ls, cat, `ps`/`env`/`uname`, refus `sudo`, erreurs `su`/`ssh`/`gcc`, `sudo -l`) **restent en anglais** — un vrai Linux les affiche en anglais et l'immersion d'un jeu de hacking en dépend. Vérifié EN+FR (aucune clé brute qui fuit).
- 🟢 ⚡ **Mémoriser la langue choisie** en `localStorage`.
- 💡 🔨 **3e langue** (ES/DE) une fois le dictionnaire consolidé.

## 6. Pédagogie & valeur d'apprentissage

- ✅ 🔴 🔨 **Écran « débrief » après chaque root** — *fait.* Chaque niveau a maintenant un `debrief` (EN/FR) affiché dans la modale de victoire : nom de la faille, pourquoi elle marche, correction blue team, lien GTFOBins/HackTricks. Se met à jour si on change de langue pendant que la modale est ouverte.
- ✅ 🟠 🔨 **Mode « explication »** togglable qui commente chaque commande de la solution — *fait (v1.8).* cf. §« Prochaines idées prioritaires » pour le détail.
- ✅ 🟢 ⚡ **Cheatsheet contextuelle** — *fait (v1.2).* La sidebar liste désormais les commandes pertinentes à la **catégorie** de la machine courante (`CHEATS_BY_CAT`), et cliquer une commande l'insère dans le prompt (+ copie presse-papiers). Plus un **panneau « profil opérateur »** sur le hub : machines owned/hardened, % de complétion, barre de progression et rang (RECRUIT → ROOT WIZARD → BLUE-TEAM LEGEND).
- ✅ 💡 🏗️ **Mode « blue team »** — *fait (v1.2).* Après le root, un bouton propose de *durcir* la box : le joueur applique le correctif (`chmod u-s`, `chmod 700`, `setcap -r`…) et le moteur vérifie que la faille est fermée (`checkHardened`, data-driven via `level.harden`). Dispo sur 6 box (SUID/cron/cap/PATH/passwd/kernel), badge 🛡 sur la carte, persisté. Handlers `chmod u-s` et `setcap` ajoutés.

## 7. UX / UI

- ✅ 🟠 ⚡ **Badge root (`#rootBadge`)** : présent dans le HTML, câblé sur `body.is-root` — *fait.*
- ✅ 🟠 🔨 **Responsive mobile** — *fait (v1.2).* `@media 900/620px` : topbar en flex-wrap, colonnes empilées, body scrollable sur téléphone, tailles réduites, hub 1 colonne.
- 🟢 ⚡ **Effet machine à écrire / délai** sur les bannières et sorties root (immersion).
- ✅ 🟢 ⚡ **Son optionnel** — *fait (v1.2).* `js/sfx.js` (Web Audio, zéro asset) : frappe / Enter / erreur / arpège de victoire, opt-in via toggle 🔊, persisté.
- ✅ 🟢 ⚡ **Copie en un clic** — *fait (v1.2).* Clic sur une commande de la cheatsheet → insertion dans le prompt + copie presse-papiers.
- ✅ 🟢 🔨 **Succès / achievements** — *fait (v1.2).* 8 badges (First Blood, Apprentice, Halfway, Root Wizard, Defender, Blue-Team Legend, Ghost/rang S, Speedrunner) affichés sur le hub, toast au déblocage, persistés en localStorage.
- 🟢 🔨 **Défi du jour / box aléatoire** — *idée.* Bouton « surprends-moi » + seed quotidien pour la rejouabilité.
- 🟢 🔨 **Carte « preuve de root » partageable** — *idée.* Générer une image/URL récapitulative (box, rang, temps, badges) après complétion, pour un portfolio.
- ✅ 🟢 ⚡ **Timer speedrun + meilleurs temps par box** — *fait (v1.3).* `GAME.bestTimes` (persisté) garde le meilleur temps par box, affiché dans le scorecard (« ★ nouveau record ! » sur un PB) et sous forme de badge ⏱ sur les cartes owned du hub.
- ✅ 🟢 ⚡ **`Ctrl+R`** (recherche d'historique) et historique persistant entre machines — *fait (v1.3, cf. §4).*
- ✅ 🟢 ⚡ **Thèmes** — *fait (v1.2).* Sélecteur (topbar + hub) de 5 palettes — **Kali** (défaut), **Matrix**, **Dracula**, **Amber** (CRT), **Light** — via `data-theme` sur `<html>`, persisté en `localStorage`. Chaque surface lit des variables CSS, donc un thème = un override de variables.

## 8. Qualité, tests & CI

- ✅ 🔴 🔨 **Tests end-to-end** — *fait (v1.2).* Suite **Playwright** (`tests/rootquest.spec.js`) : un test par machine qui joue la solution dans un vrai navigateur et vérifie root + flag + scorecard, plus rendu du hub et pipes. Doublée d'un **harnais Node** browserless (`tests/harness.js`, 14/14, EN+FR) et d'un serveur statique sans dépendance (`tests/serve.js`). **16/16 verts** en local.
- ✅ 🟠 ⚡ **GitHub Actions** — *fait (v1.2).* `.github/workflows/ci.yml` : `node --check` + harnais (EN/FR) + Playwright sur chaque push/PR.
- ✅ 🟠 ⚡ **Déploiement GitHub Pages** — *fait (v1.2).* `.github/workflows/deploy-pages.yml` publie les fichiers de l'app à chaque push sur `main` (à activer une fois dans Settings → Pages → Source: GitHub Actions).
- ✅ 🟢 ⚡ **Fichier `LICENSE`** — *fait.* Fichier MIT ajouté à la racine.
- 🟢 ⚡ **Lint ESLint** — non fait (le CI se contente de `node --check`).
- ✅ 🟢 ⚡ **Validation d'accessibilité** — *fait (v1.3).* `role="log"` + `aria-live="polite"` + `aria-label` sur la sortie et l'entrée du terminal, focus visible cohérent (`:focus-visible`) sur tous les éléments interactifs, carte de niveaux et cheatsheet navigables au clavier (`role="button"`, `tabindex`, `Enter`/`Espace`).

## 9. Architecture / dette technique

- ✅ 🟠 🔨 **Sortir le patch monkey-patch de `runOne`** — *fait (v1.1).* Le cas cron n'est plus câblé sur `level.id === 2`/un chemin en dur : il lit le chemin depuis `wins: [{ type: 'cron_hijack', path }]`. Même traitement pour le PATH-hijack (`runStatusBinary` → `runSuidHelper` générique). Un système de hooks par niveau plus formel reste envisageable si le nombre de mécaniques explose.
- 🟢 🔨 **Modules ES (`import`/`export`)** au lieu de tout mettre sur `window.*` — plus maintenable si le projet grossit.
- 🟢 ⚡ **Constantes partagées** : les chemins/UID/messages « ELF binary » sont répétés dans chaque `fs` de niveau ; factoriser un système de fichiers de base + overrides.
- 🟢 ⚡ **`data-testid`** de test à conserver mais documenter leur rôle.

---

## 10. 🚀 MOONSHOTS — idées complètement folles

> Section « et si on n'avait aucune limite ». Presque tout est 🏗️/💡, souvent hors-scope raisonnable — mais c'est là que rootQuest devient légendaire au lieu d'être « encore un jeu de terminal ».

### 🧠 Un adversaire vivant qui te traque (Blue Team IA)
- 💡 🏗️ **Sysadmin IA en temps réel** : un NPC qui *surveille les logs pendant que tu joues*. Tu tapes `find / -perm -4000` → il reçoit une alerte, patche le SUID **sous tes yeux**, kill ton shell, change les mots de passe. Tu dois aller plus vite que lui. Machine d'état scriptée au départ, puis pilotée par un vrai LLM (Claude API) qui « lit » ton terminal et décide de sa réaction.
- 💡 🏗️ **Score de furtivité** : chaque commande génère des traces (auth.log, bash_history, timestamps). Un vrai **SIEM simulé** monte une jauge de détection. Objectif bonus : rooter *sans déclencher l'IDS* — timestomping, `unset HISTFILE`, log wiping. → branchement naturel avec ton projet **[[projet-pulse]]** (IDS/IPS) comme moteur de détection.
- 💡 🔨 **Mentor IA** : un tuteur LLM qui observe ta session, comprend où tu bloques et te coache en langage naturel (« tu as vu le bit `s` sur `find` ? pense à GTFOBins ») au lieu des 3 indices figés.

### 🐧 Un VRAI Linux dans le navigateur (le graal technique)
- 💡 🏗️ **Booter un noyau Linux réel en WebAssembly** (v86 / WebVM / une image busybox) et faire de la **vraie escalade de privilèges sur un vrai kernel** sandboxé dans l'onglet. Fini la simulation : les payloads GTFOBins fonctionnent *pour de vrai*. C'est le passage de « jeu » à « lab d'entraînement OSCP jouable offline ».
- 💡 🏗️ **Interpréteur bash complet** (étape intermédiaire) : pipes, variables, boucles `for`, sous-shells, substitution `$(...)`, vrais `grep/awk/sed`. Remplace le mini-parseur actuel par un shell POSIX crédible.

### ⚔️ Multijoueur & compétition
- 💡 🏗️ **Course PvP en temps réel** (WebRTC/WebSocket) : deux joueurs, la même box, premier à `/root/flag.txt` gagne. Tu vois l'avancement de l'adversaire.
- 💡 🏗️ **Mode « Twitch plays rootQuest »** : le chat vote les commandes.
- 💡 🔨 **Speedrun + leaderboard mondial** : chrono, splits par machine, **ghost replay** (rejoue la session d'un autre joueur en surimpression), carte « root proof » partageable signée cryptographiquement.

### 🎲 Génération infinie (roguelike)
- 💡 🏗️ **Générateur procédural de machines** : un moteur qui compose aléatoirement des vulnérabilités (SUID + cron + caps…) pour une box inédite à chaque run. Rejouabilité infinie.
- 💡 🏗️ **Campagne roguelike / metroidvania** : progression persistante, arbre de compétences, on *débloque des outils et des exploits* comme du loot, runs en permadeath, difficulté qui monte.
- 💡 🔨 **Ingestion de la vraie base GTFOBins** : parser le JSON GTFOBins pour **auto-générer des niveaux** à partir de failles réelles et rester à jour tout seul.

### 🌐 Réseau & pivoting — fusion de ton écosystème
- 💡 🏗️ **Réseau complet de machines** : plus une box isolée mais une topologie — `ssh` vers d'autres hôtes simulés, mouvement latéral, credential reuse, pivot user → user → root → autre serveur. La topologie viendrait de **[[projet-netforge]]** (VLAN/ACL), la cible réelle générée par **[[projet-vagrantforge]]**, la détection par **[[projet-pulse]]**. Un seul univers « SISR » relié.
- 💡 🏗️ **Filesystem vivant** : des process qui tournent, des logs qui s'écrivent, d'autres « users » qui se connectent et laissent des credentials en clair, cron qui **tic pour de vrai** sur un timer.

### 🎬 Immersion totale
- 💡 🔨 **Mode histoire** : thriller hacker avec personnages, cinématiques ASCII dans le terminal, choix narratifs branchés, un mentor mystérieux qui te file des missions.
- 💡 🔨 **Après le root : générer un « attack graph » animé** (kill chain) qui rejoue visuellement ta chaîne d'exploitation — parfait pour un portfolio / un rapport de pentest.
- 🟢 🔨 **Esthétique CRT rétro** : phosphore, scanlines, glitch, matrix rain, tremblement d'écran quand tu passes root. Thèmes déblocables.
- 💡 🔨 **Mode Chaos** : la box se défend activement (fork bomb, disque qui se remplit, réseau qui drop) — tu dois rooter sous pression.

### 🏆 Méta & social
- 💡 🔨 **Éditeur de niveaux + machines communautaires** : créer sa box, l'exporter en URL (JSON encodé) ou fichier, importer celles des autres. « Steam Workshop » du privesc.
- 💡 🔨 **Preuve de root vérifiable** : la chaîne de flags signe un certificat → badge GitHub / open-badge affichable sur ton profil.
- 💡 🔨 **PWA + push notifications** : le cron du niveau 2 t'envoie une notif « [+] cron fired as root » même onglet fermé. Hacking « on the toilet ».

---

## 🎯 Prochaines idées prioritaires (proposées par l'assistant)

Shortlist actionnable pour l'après-v1.4 (le gros du backlog historique est ✅). Ordre = ROI décroissant.

**Court terme — rapides, fort impact**
1. 🔴 ⚡ **Activer GitHub Pages** (Settings → Pages → Source: GitHub Actions) — le workflow `deploy-pages.yml` existe déjà, il ne manque que l'activation manuelle → démo jouable en ligne.

**Moyen terme — contenu & rejouabilité**
2. ✅ 🟢 🔨 **Éditeur de box + import/export JSON** — *fait (v1.6), en partie.* Panneau « Custom box » sur le hub : coller un JSON de box valide l'ajoute comme machine jouable (tier dédié « Personnalisées »), persistée en `localStorage`. Chaque carte a un bouton `{ }` qui copie le JSON authored de la box dans le presse-papiers. Pas d'éditeur visuel (JSON brut only) ni de partage par URL encodée — ouvert si le besoin se confirme.
3. ✅ 🟢 🔨 **Défi du jour / box aléatoire** — *fait (v1.7).* Bandeau « défi du jour » sur le hub (seed déterministe basé sur la date, même box pour tout le monde un jour donné, box intégrées uniquement — les box perso restent locales au navigateur donc exclues du pool partagé) + bouton « 🎲 Surprends-moi » qui tire au sort parmi les box non encore possédées (retombe sur tout le pool si tout est fait).
4. 🟢 🔨 **Carte « preuve de root » partageable** (image/URL) générée après complétion — parfait pour un portfolio.
5. 🟢 🔨 **Éditeur `nano` en jeu** (édition simple de scripts/cron pour un réalisme accru des box cron/wildcard).
6. ✅ 🟠 🔨 **Mode « explication »** togglable qui commente chaque commande de la solution (cf. §6) — *fait (v1.8).* Bouton 🎓 dans la topbar, persisté en `localStorage`. Panneau dédié sous le cheatsheet (`js/walkthrough.js`) : solution intégrale commentée pour les 23 box (commande + pourquoi ça marche, EN/FR), séparé des indices existants — ne consomme pas de slot d'indice, n'affecte pas le rang S. Non disponible pour les box perso (message dédié).

**Long terme — moonshots** (voir §10) : mode histoire/campagne roguelike, adversaire IA blue-team en temps réel, vrai noyau Linux en WASM, multijoueur PvP, génération procédurale de box, ingestion GTFOBins.

---

*Généré le 2026-07-11, révisé le 2026-07-19 (v1.8 : mode explication — bouton 🎓 togglable, solution intégrale commentée par box, commande + pourquoi ça marche, EN/FR, séparé des indices existants et du scoring — au-dessus de la base v1.7 : défi du jour (seed déterministe par date) + bouton surprends-moi, import/export JSON de box perso (panneau « Custom box » sur le hub, tier dédié, persistance `localStorage`, export presse-papiers par carte), box-23 NFS `no_root_squash` (`mount`/`showmount`), `sudo -l` demande un mot de passe simulé une fois par machine, box-21 `cap_dac_read_search`/crack shadow, box-22 `sudo LD_LIBRARY_PATH`, box-16 à box-20 GTFOBins sudo find/env/python3/less/tee, historique de commandes persistant + `Ctrl+R`, timer speedrun + meilleurs temps sur le hub, permissions réelles sur `>`/`>>`/`tee`, accessibilité clavier/ARIA). Ce document est un backlog vivant — coche, réordonne, supprime au fil de l'eau.*
