# 🗺️ Fiche de route — rootQuest

Feuille de route des améliorations possibles pour **rootQuest** (jeu de terminal d'escalade de privilèges Linux, 100 % vanilla JS).
Statut actuel : **v1.0 fonctionnelle** — 5 machines, 5 vulnérabilités, bilingue EN/FR, aucune dépendance de build.

Légende : 🔴 prioritaire · 🟠 important · 🟢 confort · 💡 idée long terme
Effort : ⚡ rapide (<1 h) · 🔨 moyen · 🏗️ lourd

---

## 1. Persistance & état du jeu

- 🔴 ⚡ **Sauvegarder la progression en `localStorage`** — actuellement `GAME.completed` est perdu à chaque rechargement. Restaurer les niveaux terminés + le niveau courant au boot.
- 🟠 ⚡ **Bouton « Reset progression »** distinct du reset de machine (le `reset` actuel ne recharge que la machine courante).
- 🟢 🔨 **Statistiques par machine** : nombre d'indices utilisés, nombre de commandes tapées, temps de résolution → stockés et affichés dans le modal de victoire.

## 2. PWA & offline (alignement avec tes autres projets)

- 🔴 🔨 **Passer en vraie PWA** : `manifest.webmanifest` + `service-worker.js` + icônes (192/512). Tes projets Labs, Revision-it, Annuaire, LinuxDojo sont déjà des PWA — rootQuest ne l'est pas encore.
- 🔴 ⚡ **Supprimer la dépendance Google Fonts** (`index.html` charge JetBrains Mono + Space Grotesk depuis un CDN). Le README affirme « no dependencies / no server » : héberger les polices en local (ou fallback `monospace`) pour un vrai offline-first.
- 🟢 ⚡ **Favicon** + `theme-color` + meta description/OpenGraph pour le partage.

## 3. Contenu — nouvelles machines / vulnérabilités

Le moteur ne gère aujourd'hui que 5 vecteurs. Idées de niveaux supplémentaires (chacune une faille classique GTFOBins / privesc) :

- 🟠 🔨 **Writable `/etc/passwd`** — ajouter un utilisateur root sans mot de passe (`openssl passwd` / hash `::0:0:`).
- 🟠 🔨 **`sudo` avec `LD_PRELOAD` / `env_keep`** — bibliothèque malveillante.
- 🟠 🔨 **Wildcard injection** (`tar`/`chown` avec `*` dans un cron ou script root).
- 🟠 🏗️ **Groupe `docker`** — `docker run -v /:/mnt` pour lire/écrire l'hôte.
- 🟢 🏗️ **NFS `no_root_squash`**, **`cap_dac_read_search`**, **kernel exploit (style Dirty COW / PwnKit)** en version simulée pédagogique.
- 💡 🏗️ **Chaînes multi-étapes** : une machine qui exige énumération → pivot user intermédiaire → root (plusieurs UID).

## 4. Moteur terminal & réalisme du shell

- 🔴 🔨 **Découpler la logique de « win » des données `levels[].wins`** — actuellement les conditions de victoire sont codées en dur dans `commands.js` (`spawnShell(true)` dispersé) alors que chaque niveau déclare déjà un tableau `wins` **inutilisé**. Piloter la victoire par ces données rendrait l'ajout de niveaux trivial.
- 🟠 🔨 **Support des pipes (`|`)** — le code note « only support simple `| cat` for now » mais rien n'est implémenté. Ajouter `grep`, `wc`, `head`, `tail`, `sort`.
- 🟠 ⚡ **Commandes manquantes courantes** : `grep`, `env`, `uname -a`, `hostname`, `mount`, `ps` (en tant que vraie commande), `which`, `file`, `history`.
- 🟢 ⚡ **`sudo -l` sans NOPASSWD** devrait demander un mot de passe simulé (immersion).
- 🟢 🔨 **Auto-complétion des commandes** (pas seulement des chemins) sur `Tab`.
- 🟢 ⚡ **`cd -` / `cd` sans argument** → home ; gérer `pushd`/`popd` optionnel.
- 🟢 🔨 **Persistance de l'historique** entre machines (localStorage) + navigation `Ctrl+R` (recherche).

## 5. Internationalisation (i18n)

- 🟠 🔨 **Traduire la sortie du terminal** — aujourd'hui `commands.js` contient beaucoup de texte anglais en dur (`help`, sorties de `sudo`, `spawnShell`, `runStatusBinary`, messages `vim`/`python`). Seul l'UI statique (`data-i18n`) et les niveaux sont bilingues. La bascule FR laisse le terminal majoritairement en anglais.
- 🟢 ⚡ **Mémoriser la langue choisie** en `localStorage`.
- 💡 🔨 **3e langue** (ES/DE) une fois le dictionnaire consolidé.

## 6. Pédagogie & valeur d'apprentissage

- 🔴 🔨 **Écran « débrief » après chaque root** : rappel de la faille, pourquoi elle existe, comment la corriger (blue team), lien GTFOBins/HackTricks. C'est le vrai différenciateur pédagogique.
- 🟠 🔨 **Mode « explication »** togglable qui commente chaque commande de la solution.
- 🟢 ⚡ **Cheatsheet contextuelle** : la sidebar affiche toujours les mêmes commandes ; les adapter à la machine courante.
- 💡 🏗️ **Mode « blue team »** : à partir d'une machine vulnérable, l'utilisateur doit la *durcir* (retirer le SUID, corriger le cron…).

## 7. UX / UI

- 🟠 ⚡ **Badge root (`#rootBadge`)** : présent dans le HTML (`display:none`) mais jamais activé par le JS — soit le câbler à `is-root`, soit le retirer.
- 🟠 🔨 **Responsive mobile** : le terminal + sidebar en 2 colonnes n'est pas pensé pour petit écran ; layout empilé + gestion du clavier virtuel.
- 🟢 ⚡ **Effet machine à écrire / délai** sur les bannières et sorties root (immersion).
- 🟢 ⚡ **Son optionnel** (frappe clavier, « root obtained »).
- 🟢 ⚡ **Copie en un clic** des payloads d'indices.
- 🟢 ⚡ **Thèmes** : le style est « Kali/Parrot » ; proposer un switch (Matrix green, Dracula, light).

## 8. Qualité, tests & CI

- 🔴 🔨 **Tests end-to-end** : les `data-testid` sont déjà partout dans le HTML (`terminal`, `term-input`, `level-node-*`, `hint-button`…) → il ne manque que la suite Playwright. Un test par machine qui joue la solution et vérifie le flag.
- 🟠 ⚡ **GitHub Actions** : lint (ESLint) + exécution des tests + déploiement GitHub Pages automatique.
- 🟠 ⚡ **Déploiement GitHub Pages** pour une démo jouable en ligne (comme tes autres projets).
- 🟢 ⚡ **Fichier `LICENSE`** — le README annonce MIT mais le fichier n'existe pas.
- 🟢 ⚡ **Validation d'accessibilité** : rôles ARIA sur le terminal (`role="log"`, `aria-live`), focus visible, navigation clavier complète.

## 9. Architecture / dette technique

- 🟠 🔨 **Sortir le patch monkey-patch de `runOne`** (fin de `commands.js`, cas cron du niveau 2 câblé en dur) vers un système de hooks par niveau propre.
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

1. **localStorage** (progression + langue) — gros gain, effort minime. 🔴⚡
2. **Supprimer la dépendance Google Fonts + PWA** — tenir la promesse « offline, no deps ». 🔴🔨
3. **Piloter les victoires par `levels[].wins`** — débloque l'ajout facile de machines. 🔴🔨
4. **Écran de débrief pédagogique** — la vraie valeur ajoutée. 🔴🔨
5. **Suite de tests Playwright + GitHub Pages + CI**. 🔴🟠
6. Puis enrichir le contenu (nouvelles machines) et l'i18n du terminal.

---

*Généré le 2026-07-11. Ce document est un backlog vivant — coche, réordonne, supprime au fil de l'eau.*
