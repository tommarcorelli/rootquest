// Bilingual dictionary (EN / FR)
window.I18N = {
    en: {
        brandTag: 'Linux Privilege Escalation Playground',
        levelLabel: 'Level',
        hintBtn: 'Hint',
        resetBtn: 'Reset',
        missionTag: 'MISSION',
        statusActive: 'Active',
        statusDone: 'Owned',
        objectiveLabel: 'Objective',
        targetLabel: 'Target',
        cheatsheetTitle: 'Useful commands',
        rootShellTitle: 'ROOT SHELL OBTAINED',
        winSub: 'You escalated to root. Ready for the next machine?',
        nextLevelBtn: 'Next machine →',
        replayBtn: 'Replay',
        completedTitle: 'ALL MACHINES OWNED',
        completedSub: 'You cleared every privesc challenge. Nice hunt.',
        restartAllBtn: 'Restart from Level 1',
        hintTypeHelp: 'Type <code>help</code> to list available commands.',
        // Terminal messages
        welcome: [
            '',
            '  ╭─────────────────────────────────────────────╮',
            '  │   rootQuest v1.0 — PrivEsc Challenges       │',
            '  │   5 machines, 5 vulnerabilities, 1 goal.    │',
            '  ╰─────────────────────────────────────────────╯',
            '',
            '  Objective: escalate from user → root.',
            '  Type "help" for a list of commands, "hint" for a nudge.',
            ''
        ],
        cmdNotFound: (c) => `${c}: command not found`,
        noSuchFile: (f) => `${f}: No such file or directory`,
        permDenied: (f) => `${f}: Permission denied`,
        isDirectory: (f) => `${f}: Is a directory`,
        notDirectory: (f) => `${f}: Not a directory`,
        missingOp: (c) => `${c}: missing operand`,
        rootObtained: 'You are now root.',
        alreadyRoot: 'You already have a root shell.',
        cronWaiting: '[*] Waiting for cron to trigger... (press Enter or type "wait")',
        cronFired: '[+] Cron job fired as root. Payload executed.',
        hintUsed: 'Hint',
        noMoreHints: 'No more hints for this level.',
        helpHeader: 'Available commands:',
        rootWelcome: '# You have root. Type "next" to continue to the next machine.',
    },
    fr: {
        brandTag: "Terrain de jeu d'escalade de privilèges Linux",
        levelLabel: 'Niveau',
        hintBtn: 'Indice',
        resetBtn: 'Réinit.',
        missionTag: 'MISSION',
        statusActive: 'En cours',
        statusDone: 'Terminé',
        objectiveLabel: 'Objectif',
        targetLabel: 'Cible',
        cheatsheetTitle: 'Commandes utiles',
        rootShellTitle: 'SHELL ROOT OBTENU',
        winSub: 'Tu es passé en root. Prêt pour la prochaine machine ?',
        nextLevelBtn: 'Machine suivante →',
        replayBtn: 'Rejouer',
        completedTitle: 'TOUTES LES MACHINES OWNED',
        completedSub: 'Tu as bouclé tous les défis de privesc. Beau chasseur.',
        restartAllBtn: 'Recommencer au niveau 1',
        hintTypeHelp: 'Tape <code>help</code> pour voir les commandes disponibles.',
        welcome: [
            '',
            '  ╭─────────────────────────────────────────────╮',
            '  │   rootQuest v1.0 — Défis PrivEsc             │',
            '  │   5 machines, 5 failles, 1 objectif.         │',
            '  ╰─────────────────────────────────────────────╯',
            '',
            '  Objectif : passer de user → root.',
            '  Tape "help" pour la liste des commandes, "hint" pour un coup de pouce.',
            ''
        ],
        cmdNotFound: (c) => `${c} : commande introuvable`,
        noSuchFile: (f) => `${f} : fichier ou dossier introuvable`,
        permDenied: (f) => `${f} : permission refusée`,
        isDirectory: (f) => `${f} : est un dossier`,
        notDirectory: (f) => `${f} : n'est pas un dossier`,
        missingOp: (c) => `${c} : opérande manquante`,
        rootObtained: 'Tu es maintenant root.',
        alreadyRoot: 'Tu as déjà un shell root.',
        cronWaiting: '[*] Attente du déclenchement de cron... (appuie sur Entrée ou tape "wait")',
        cronFired: '[+] Cron déclenché en tant que root. Payload exécuté.',
        hintUsed: 'Indice',
        noMoreHints: "Plus d'indices disponibles pour ce niveau.",
        helpHeader: 'Commandes disponibles :',
        rootWelcome: '# Tu as root. Tape "next" pour passer à la machine suivante.',
    }
};

window.currentLang = 'en';

window.t = function(key, ...args) {
    const dict = I18N[window.currentLang] || I18N.en;
    const v = dict[key];
    if (typeof v === 'function') return v(...args);
    return v !== undefined ? v : key;
};

window.applyI18n = function() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = t(key);
        if (typeof val === 'string') el.innerHTML = val;
    });
};
