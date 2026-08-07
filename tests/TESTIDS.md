# `data-testid` reference

Every `data-testid` in the app exists to give Playwright a stable hook that
survives copy/theme/layout changes (unlike CSS classes or text content, which
change with i18n and restyling). This is the map from id → what it is and
where it's asserted, kept next to the tests it serves — update it whenever
you add, rename, or remove one.

## Home / hub screen

| testid | element | purpose |
|---|---|---|
| `home-screen` | hub container | root node for "are we on the hub" checks |
| `home-grid` | machine grid | box list is rendered |
| `machine-card-<id>` | one card per box | select/enter a specific machine (`<id>` = level id, e.g. `machine-card-1`) |
| `machine-card-export-<id>` | `{ }` button on a card | copies that box's authored JSON to the clipboard |
| `machine-card-share-<id>` | `🔗` button on a custom-box card | copies a self-contained share link (`#box=...`) for that custom box |
| `home-start-btn` | "start" / resume button | jump into the current/last machine |
| `home-lang-toggle` | language switch (hub) | mirrors `lang-toggle` in the topbar |
| `home-theme-select` | theme `<select>` (hub) | mirrors `theme-select` in the topbar |
| `home-sound-btn` | sound toggle (hub) | mirrors `sound-btn` in the topbar |
| `home-custom` | "Custom box" panel toggle | opens the import/export panel |
| `custom-panel` | custom-box panel | container for JSON import/export |
| `custom-toggle-btn` | panel open/close button | |
| `custom-json-input` | `<textarea>` | paste a box's JSON to import |
| `custom-import-btn` | import button | validates + appends the pasted JSON as a playable box |
| `custom-json-msg` | feedback line | success/error text after an import attempt |
| `daily-challenge` | daily-challenge banner | date-seeded box of the day |
| `daily-play-btn` | its play button | jumps straight into that box |
| `surprise-btn` | "Surprise me" button | random unowned box |
| `operator-status` | operator profile panel | rank/completion shown on the hub |
| `achievements` | achievements strip | unlocked badges |
| `reset-progress-btn` | "Reset progress" button | wipes `localStorage` save (with confirmation) |
| `restart-all-btn` | replay-everything button | shown once all boxes are owned |

## Custom box · visual builder & graphical editor

Three tabs share the same `#customJsonInput` textarea and `GAME_CUSTOM.import()`
flow — these testids are only for the two assistants that fill that textarea
for you (`js/boxbuilder.js`, `js/boxeditor.js`); the paste-JSON ids are in the
table above.

| testid | element | purpose |
|---|---|---|
| `custom-mode-tabs` | tab row | switches between the three modes below |
| `custom-mode-paste-btn` | "📋 Coller du JSON" tab | shows the raw-paste textarea |
| `custom-mode-build-btn` | "🧰 Assistant visuel" tab | shows the template form |
| `custom-mode-graph-btn` | "🗂️ Éditeur graphique" tab | shows the fs-tree builder |
| `custom-build-panel` | template form container | |
| `cb-template` | vulnerability-type `<select>` | picks one of the 5 templates |
| `cb-codename` / `cb-title` / `cb-brief` / `cb-flag` | metadata inputs | box identity fields |
| `cb-path` | path input | binary/script path (hidden for templates that don't need one) |
| `cb-sudobin` | sudo-binary `<select>` | shown only for the sudo GTFOBins template |
| `cb-hijackcmd` | unqualified-command input | shown only for the PATH hijack template |
| `cb-generate-btn` | "Générer le JSON ↓" | assembles the box, fills `custom-json-input`, switches to the paste tab |
| `cb-msg` | feedback line | reserved for future validation messages |
| `custom-graph-panel` | graphical editor container | |
| `cg-codename` / `cg-title` / `cg-brief` / `cg-flag` | metadata inputs | box identity fields |
| `cg-start` | "Partir de" `<select>` | empty skeleton or one of the 5 templates as a base |
| `cg-load-start-btn` | "↻ Charger ce point de départ" | (re)initializes the tree from the chosen starting point |
| `cg-body` | tree + node-editor row | layout container |
| `cg-tree` | fs-tree container | click any row (`[data-path]`) to select that node |
| `cg-node-editor` | node property form | rebuilt on every selection change |
| `cgn-owner` / `cgn-mode` / `cgn-content` | node fields | present for the node type they apply to (content: files only) |
| `cgn-suid` / `cgn-writable` | node checkboxes | SUID bit / world-writable (files only) |
| `cgn-calls` | "Calls unqualified command" input | drives the PATH-hijack `calls_unqualified` mechanic (files only) |
| `cgn-exploit` | "Direct exploit type" input | self-contained `exploit` mechanic — also feeds the "Auto" win condition (files only) |
| `cg-save-node-btn` | "Enregistrer" | writes the form back into the selected node |
| `cg-add-file-btn` / `cg-add-dir-btn` | "+ Fichier" / "+ Dossier" | prompts for a name, creates a child under the selected dir |
| `cg-delete-node-btn` | "Supprimer" | recursively deletes the selected node (confirmation prompt); absent for `/` |
| `cg-wintype` | win-condition `<select>` | auto / cron / passwd / sudo / path-hijack / custom |
| `cg-winfields` | dynamic fields container | rebuilt to match the chosen win type |
| `cg-win-path` | path input | shown for cron_hijack and path_hijack |
| `cg-win-hijackcmd` | unqualified-command input | shown for path_hijack |
| `cg-win-sudobin` | sudo-binary `<select>` | shown for sudo_shell |
| `cg-win-customtype` | free-text win-type input | shown for "custom" |
| `cg-generate-btn` | "Générer le JSON ↓" | assembles the box via `BOXEDITOR.buildBox()`, fills `custom-json-input`, switches to the paste tab |
| `cg-msg` | feedback line | reserved for future validation messages |

## In-mission topbar / terminal

| testid | element | purpose |
|---|---|---|
| `terminal` | terminal panel | scroll container |
| `term-output` | output log | asserted on for command results (`toContainText`, etc.) |
| `term-input` | command input | where `page.fill` / `page.press` drive the game |
| `menu-button` | back-to-hub button | |
| `lang-toggle`, `lang-en`, `lang-fr`, `lang-es` | language buttons | switch EN/FR/ES mid-mission |
| `theme-select` | theme `<select>` | |
| `sound-btn` | SFX toggle | |
| `reset-button` | "reset machine" | restarts the current box only |
| `hint-button` | hint button | consumes a hint slot (affects rank) |
| `blue-team-btn` | harden button | post-root blue-team challenge |
| `explain-btn` | 🎓 walkthrough toggle | opens `walkthrough-panel` |
| `mentor-btn` | 🧭 mentor mode toggle | enables contextual coaching lines (`.mentor` terminal class), see `js/mentor.js` |
| `killchain-panel` | kill chain panel in the win modal | populated by `GAME.renderKillChain()`, built from `WALKTHROUGHS` |
| `halloffame-toggle` / `halloffame-panel` | hub Hall of Fame collapsible | populated by `GAME.renderHallOfFame()` from `this.bestTimes` |
| `hof-ghost-btn` (class, not testid — `[data-ghost-id]`) | 👻 per-entry ghost replay button | delegated click in `halloffamePanel`, calls `GAME.playGhost(id)` |
| `notify-toggle-btn` | 🔔 daily-challenge reminder opt-in | `GAME.shouldNotifyDaily()`/`fireDailyNotificationIfDue()`, foreground-only Notification API |
| `install-btn` | PWA install button | hidden until `beforeinstallprompt` fires, calls `.prompt()` |
| `walkthrough-panel` | commented full solution | non-scored, hidden for custom boxes |
| `mission-title`, `mission-brief`, `objectives-list` | mission card | current box's briefing |
| `level-node-<id>` | tier map node | per-box progress marker outside the hub grid |
| `nano-editor`, `nano-status` | in-game `nano` overlay | full-screen editor used by cron/wildcard boxes |

## Win / proof / final modals

| testid | element | purpose |
|---|---|---|
| `win-stats`, `win-debrief` | victory modal body | scorecard (rank/time/hints) + exploit debrief |
| `next-level-btn`, `win-menu-btn` | victory modal actions | |
| `proof-btn`, `proof-canvas`, `proof-download-btn`, `proof-close-btn` | "root proof" card | shareable PNG generated client-side |
| `replay-btn`, `final-menu-btn` | final (all-boxes-owned) modal | |

Ids not listed here shouldn't be assumed stable — check the element's own
markup before writing a new assertion against it.
