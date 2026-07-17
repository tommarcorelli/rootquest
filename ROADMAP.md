# 🗺️ Fiche de route — rootQuest

Feuille de route des améliorations possibles pour **rootQuest** (jeu de terminal d'escalade de privilèges Linux, 100 % vanilla JS).
Statut actuel : **v1.2 fonctionnelle** — 13 machines réparties en 3 tiers (Débutant / Intermédiaire / Avancé), 13 vulnérabilités, hub par tiers + scorecard de victoire, terminal réaliste (pipes + `grep`/`ps`/`env`/…), bilingue EN/FR, aucune dépendance de build.

Légende : 🔴 prioritaire · 🟠 important · 🟢 confort · 💡 idée long terme
Effort : ⚡ rapide (<1 h) · 🔨 moyen · 🏗️ lourd

---

## 1. Persistance & état du jeu

- ✅ 🔴 ⚡ **Sauvegarder la progression en `localStorage`** — *fait.* `GAME.completed` + langue persistés dans `localStorage` (clé `rootquest_save_v1`), restaurés au boot.
- ✅ 🟠 ⚡ **Bouton « Reset progression »** distinct du reset de machine — *fait.* Bouton dédié sur l'écran d'accueil, avec confirmation avant effacement.
- ✅ 🟢 🔨 **Statistiques par machine** — *fait.* Indices utilisés, commandes tapées et temps de résolution sont suivis et affichés dans un **scorecard** de la modale de victoire, avec un score et un rang S/A/B/C (0 indice = rang S doré).

## 2. PWA & offline (alignement avec tes autres projets)

- ✅ 🔴 🔨 **Passer en vraie PWA** — *fait.* `manifest.webmanifest` + `service-worker.js` (cache-first de l'app shell, fallback offline sur `index.html`) + icônes 192/512 (+ maskable) + logo cyberpunk dédié.
- ⚠️ 🔴 ⚡ **Supprimer la dépendance Google Fonts** — *pas fait.* Le CDN reste en place (pas d'accès réseau à `fonts.gstatic.com` depuis l'environnement où j'ai travaillé). Le service worker ne cache que les assets same-origin ; les polices retombent sur `monospace`/`sans-serif` hors-ligne. Pour un vrai offline-first : héberger les `.woff2` dans `assets/fonts/` et basculer sur `@font-face` locales.
- ✅ 🟢 ⚡ **Favicon** + `theme-color` + meta description/OpenGraph — *fait.*

## 3. Contenu — nouvelles machines / vulnérabilités

Le moteur gère désormais **13 vecteurs** (5 d'origine + 5 en v1.1 + 3 en v1.2). Statut des idées :

- ✅ 🟠 🔨 **Writable `/etc/passwd`** — *fait (box-06).* Ajout d'un root sans mot de passe (`r00t::0:0::/root:/bin/bash`) puis `su r00t`.
- ✅ 🟠 🔨 **`sudo awk` (GTFOBins)** — *fait (box-07).* NOPASSWD sur `awk` → `sudo awk 'BEGIN{system("/bin/sh")}'`.
- ✅ 🟢 🏗️ **Kernel exploit simulé** — *fait (box-08).* PwnKit / CVE-2021-4034 en version pédagogique (`./pwnkit`).
- ✅ 💡 🏗️ **Chaîne multi-étapes** — *fait (box-09).* Creds en clair → pivot `su svc` → `sudo bash` (plusieurs UID).
- ✅ 🟠 🏗️ **Groupe `docker`** — *fait (box-10).* `docker run -v /:/mnt` pour monter l'hôte.
- ✅ 🟠 🔨 **`sudo` avec `LD_PRELOAD` / `env_keep`** — *fait (box-11).* `env_keep+=LD_PRELOAD` + `.so` compilé via `gcc` → `sudo LD_PRELOAD=/tmp/x.so apache2ctl`.
- ✅ 🟠 🔨 **Wildcard injection** — *fait (box-12).* `tar -czf ... *` dans un cron root + fichiers-options `./--checkpoint-action=exec=sh runme.sh`.
- ✅ 🟢 🔨 **Clé SSH root lisible** — *fait (box-13).* Clé privée world-readable dans une sauvegarde → `ssh -i /opt/backup/id_rsa root@localhost`.
- 🟢 🏗️ **NFS `no_root_squash`**, **`cap_dac_read_search`**, **`chown`/wildcard sur autre binaire** — *encore ouvert.*

## 4. Moteur terminal & réalisme du shell

- ✅ 🔴 🔨 **Découpler la logique de « win » des données `levels[].wins`** — *fait.* `spawnShell(true, { type })` vérifie désormais le `type` contre `level.wins[]` via `CMD.winConditionMet()` avant d'accorder root ; les 5 exploits référencent leur type déclaré (`suid_shell_via`, `cron_hijack`, `python_setuid`, `path_hijack`, `sudo_vim_escape`). `wins[]` est la source de vérité : oublier l'entrée ou se tromper de type bloque l'exploit au lieu de planter silencieusement. **v1.1** a poussé le data-driven plus loin : un nœud fs peut déclarer `exploit: '<type>'` (exploit auto-contenu), un **détecteur générique d'évasions sudo GTFOBins** (vim, awk, env, find, bash/sh, less…) pilote le bon type de victoire depuis `level.wins`, et les mécaniques cron/PATH sont dé-hardcodées (chemin lu depuis `wins`, plus de `level.id === 2`). Reste ouvert : un moteur totalement générique qui déduirait *comment* déclencher l'exploit depuis la donnée seule.
- ✅ 🟠 🔨 **Support des pipes (`|`)** — *fait (v1.2).* Pipelines quote-aware `cmd1 | cmd2 | cmd3` avec filtres `grep [-ivc]`, `wc [-l]`, `head`/`tail [-n]`, `sort [-ru]`, `uniq` (cœur partagé `_filter()`, utilisables aussi en autonome).
- ✅ 🟠 ⚡ **Commandes manquantes courantes** — *fait (v1.2).* `ps [aux]`, `env`, `uname -a`, `hostname`, `mount`, `which`, `file`, `history` (+ `touch`, `gcc`, `ssh` pour les nouvelles box). Sortie technique authentique.
- 🟢 ⚡ **`sudo -l` sans NOPASSWD** devrait demander un mot de passe simulé (immersion).
- 🟢 🔨 **Auto-complétion des commandes** (pas seulement des chemins) sur `Tab`.
- 🟢 ⚡ **`cd -` / `cd` sans argument** → home ; gérer `pushd`/`popd` optionnel.
- 🟢 🔨 **Persistance de l'historique** entre machines (localStorage) + navigation `Ctrl+R` (recherche).

## 5. Internationalisation (i18n)

- ✅ 🟠 🔨 **Traduire la sortie du terminal** — *fait (v1.2), par choix de design.* Règle : la **voix du jeu** est localisée (menu `help`, notes du simulateur `(...)`, nudges `vim`/`python`, coaching `su`/wildcard, exploit invalide) via de nouvelles clés i18n ; les **sorties verbatim d'outils/OS** (ls, cat, `ps`/`env`/`uname`, refus `sudo`, erreurs `su`/`ssh`/`gcc`, `sudo -l`) **restent en anglais** — un vrai Linux les affiche en anglais et l'immersion d'un jeu de hacking en dépend. Vérifié EN+FR (aucune clé brute qui fuit).
- 🟢 ⚡ **Mémoriser la langue choisie** en `localStorage`.
- 💡 🔨 **3e langue** (ES/DE) une fois le dictionnaire consolidé.

## 6. Pédagogie & valeur d'apprentissage

- ✅ 🔴 🔨 **Écran « débrief » après chaque root** — *fait.* Chaque niveau a maintenant un `debrief` (EN/FR) affiché dans la modale de victoire : nom de la faille, pourquoi elle marche, correction blue team, lien GTFOBins/HackTricks. Se met à jour si on change de langue pendant que la modale est ouverte.
- 🟠 🔨 **Mode « explication »** togglable qui commente chaque commande de la solution.
- 🟢 ⚡ **Cheatsheet contextuelle** : la sidebar affiche toujours les mêmes commandes ; les adapter à la machine courante.
- 💡 🏗️ **Mode « blue team »** : à partir d'une machine vulnérable, l'utilisateur doit la *durcir* (retirer le SUID, corriger le cron…).

## 7. UX / UI

- ✅ 🟠 ⚡ **Badge root (`#rootBadge`)** : présent dans le HTML, câblé sur `body.is-root` — *fait.*
- 🟠 🔨 **Responsive mobile** : le terminal + sidebar en 2 colonnes n'est pas pensé pour petit écran ; layout empilé + gestion du clavier virtuel.
- 🟢 ⚡ **Effet machine à écrire / délai** sur les bannières et sorties root (immersion).
- 🟢 ⚡ **Son optionnel** (frappe clavier, « root obtained »).
- 🟢 ⚡ **Copie en un clic** des payloads d'indices.
- 🟢 ⚡ **Thèmes** : le style est « Kali/Parrot » ; proposer un switch (Matrix green, Dracula, light).

## 8. Qualité, tests & CI

- ✅ 🔴 🔨 **Tests end-to-end** — *fait (v1.2).* Suite **Playwright** (`tests/rootquest.spec.js`) : un test par machine qui joue la solution dans un vrai navigateur et vérifie root + flag + scorecard, plus rendu du hub et pipes. Doublée d'un **harnais Node** browserless (`tests/harness.js`, 14/14, EN+FR) et d'un serveur statique sans dépendance (`tests/serve.js`). **16/16 verts** en local.
- ✅ 🟠 ⚡ **GitHub Actions** — *fait (v1.2).* `.github/workflows/ci.yml` : `node --check` + harnais (EN/FR) + Playwright sur chaque push/PR.
- ✅ 🟠 ⚡ **Déploiement GitHub Pages** — *fait (v1.2).* `.github/workflows/deploy-pages.yml` publie les fichiers de l'app à chaque push sur `main` (à activer une fois dans Settings → Pages → Source: GitHub Actions).
- 🟢 ⚡ **Fichier `LICENSE`** — le README annonce MIT mais le fichier n'existe pas.
- 🟢 ⚡ **Lint ESLint** — non fait (le CI se contente de `node --check`).
- 🟢 ⚡ **Validation d'accessibilité** : rôles ARIA sur le terminal (`role="log"`, `aria-live`), focus visible, navigation clavier complète.

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

## Prochaines étapes suggérées (ordre conseillé)

1. ✅ **localStorage** (progression + langue) — fait.
2. ✅ **PWA** (manifest + service worker + icônes) — fait. Google Fonts CDN pas retiré (voir note plus haut).
3. ✅ **Piloter les victoires par `levels[].wins`** — fait.
4. ✅ **Écran de débrief pédagogique** — fait.
5. ✅ **Enrichissement contenu v1.1** — fait. 5 nouvelles box (6→10), hub par tiers, scorecard, refactor moteur data-driven. Vérifié (harnais Node 11/11 + Chrome headless e2e).
6. ✅ **Réalisme shell (v1.2)** — fait. Pipes + filtres (`grep`/`wc`/`head`/`tail`/`sort`) + commandes d'énumération (`ps`/`env`/`uname`/…).
7. ✅ **Contenu v1.2** — fait. 3 nouvelles box (11 LD_PRELOAD, 12 wildcard tar, 13 clé SSH). Harnais Node 14/14.
8. **Suite de tests Playwright + GitHub Pages + CI**. 🔴🟠 ← en cours.
9. Puis **i18n du terminal** (beaucoup de sortie encore en anglais dur dans `commands.js`). 🟠 ← en cours.

---

*Généré le 2026-07-11, révisé le 2026-07-17 (v1.2 : 13 box + réalisme shell + pipes). Ce document est un backlog vivant — coche, réordonne, supprime au fil de l'eau.*
