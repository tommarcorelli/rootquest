# rootQuest — Linux Privilege Escalation Playground

A 100% browser-based, vanilla JS terminal game. 22 independent Linux machines, 22 different privilege-escalation vulnerabilities, sorted into difficulty tiers. Enumerate, identify, exploit, root.

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

## Commands supported

`ls`, `ls -la`, `cd`, `pwd`, `cat`, `find`, `find -perm -4000`, `find -exec ...`, `sudo`, `sudo -l`, `su`, `ssh`, `docker`, `crontab -l`, `getcap`, `setcap`, `strings`, `chmod`, `echo`, `echo >`, `echo >>`, `export`, `touch`, `gcc`, `python3 -c '...'`, `awk`, `vim`, `less`, `tee -a`, `john`, `whoami`, `id`, `wait`, `man <cmd>`.

**Enumeration & pipes:** `ps [aux]`, `env`, `uname -a`, `hostname`, `which`, `file`, `history`, `mount`, plus text filters `grep`, `wc`, `head`, `tail`, `sort`, `uniq`, `tee` — usable standalone or in a pipeline (`cat /etc/passwd | grep -v root | wc -l`, `echo payload | sudo tee -a /etc/passwd`).

Redirects (`>`/`>>`) and `tee` now respect file permissions: writing to a file you don't own and can't write fails with `Permission denied` unless you're root or the write is happening through a sudo-granted binary — box-20 relies on exactly that distinction.

`python3 -c "open(path).read()"` also respects file read permissions unless the interpreter has been granted `cap_dac_read_search`/`cap_dac_override` (box-21), in which case it bypasses them like the real capability does — and `sudo <cmd>` bypasses `env_reset` only for variables explicitly listed in a level's `env_keep` (`LD_PRELOAD` for box-11/15, `LD_LIBRARY_PATH` for box-22 — each with its own, deliberately different, hijack requirements).

## Language

Toggle EN/FR from the top-right, or type `lang fr`.

## Themes

Pick a palette from the theme selector (top bar or hub): **Kali** (default), **Matrix**, **Dracula**, **Amber** (retro CRT), or **Light**. Your choice is saved in `localStorage`.

## Structure

```
privesc-game/
├── index.html         # Entry point
├── styles.css         # Kali/Parrot-inspired terminal styling
└── js/
    ├── i18n.js        # Bilingual dictionary
    ├── levels.js      # 22 machines with their filesystems
    ├── fs.js          # Simulated filesystem
    ├── commands.js    # Command interpreter
    ├── terminal.js    # Terminal UI (history, prompt, rendering)
    └── main.js        # Game orchestration
```

## Development & tests

No build step for the game itself. For the test suite:

```
npm install                 # installs @playwright/test (dev only)
npm run serve               # preview at http://localhost:4173
npm run test:logic          # fast browserless harness (plays all 22 boxes)
npm test                    # Playwright e2e (drives a real browser)
```

- `tests/harness.js` — loads the real engine in a sandbox and plays each box's solution, asserting root (runs in EN and, with `RQLANG=fr`, in French).
- `tests/rootquest.spec.js` — Playwright: one test per machine (solution → root → flag + scorecard), plus hub-render and pipe tests. Locally it uses your installed Chrome; CI uses bundled Chromium.
- CI (`.github/workflows/ci.yml`) runs syntax checks + the harness + Playwright on every push/PR.
- Deploy (`.github/workflows/deploy-pages.yml`) publishes to GitHub Pages on push to `main` (enable once via Settings → Pages → Source: GitHub Actions).

## License

MIT — do whatever. Educational content, no real systems harmed.
