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

## In-mission topbar / terminal

| testid | element | purpose |
|---|---|---|
| `terminal` | terminal panel | scroll container |
| `term-output` | output log | asserted on for command results (`toContainText`, etc.) |
| `term-input` | command input | where `page.fill` / `page.press` drive the game |
| `menu-button` | back-to-hub button | |
| `lang-toggle`, `lang-en`, `lang-fr` | language buttons | switch EN/FR mid-mission |
| `theme-select` | theme `<select>` | |
| `sound-btn` | SFX toggle | |
| `reset-button` | "reset machine" | restarts the current box only |
| `hint-button` | hint button | consumes a hint slot (affects rank) |
| `blue-team-btn` | harden button | post-root blue-team challenge |
| `explain-btn` | 🎓 walkthrough toggle | opens `walkthrough-panel` |
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
