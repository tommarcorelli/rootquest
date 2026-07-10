# rootQuest — Linux Privilege Escalation Playground

A 100% browser-based, vanilla JS terminal game. 5 independent Linux machines, 5 different privilege-escalation vulnerabilities. Enumerate, identify, exploit, root.

## Play

Just open `index.html` in any modern browser. No build, no server, no dependencies.

```
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

## Machines

| # | Box | Vulnerability | Key command |
|---|-----|---------------|-------------|
| 1 | box-01 | SUID misconfiguration on `find` | `find . -exec /bin/sh -p \;` |
| 2 | box-02 | World-writable cron script | Overwrite `/opt/backup.sh`, `wait` |
| 3 | box-03 | Linux capability `cap_setuid+ep` on python3 | `python3 -c 'import os; os.setuid(0); os.system("/bin/sh")'` |
| 4 | box-04 | PATH hijack against a SUID helper | Fake `ps` in `/tmp`, `export PATH=/tmp:$PATH` |
| 5 | box-05 | Sudoers NOPASSWD on `vim` | `sudo vim -c ':!/bin/sh'` |

## Controls

- `help` — list available commands
- `hint` — get a nudge (3 hints per level, progressive)
- `next` — advance to next machine after rooting
- `reset` — restart the current machine
- `lang en` / `lang fr` — switch language
- `↑ / ↓` — command history
- `Tab` — path completion
- `Ctrl+L` — clear screen

## Commands supported

`ls`, `ls -la`, `cd`, `pwd`, `cat`, `find`, `find -perm -4000`, `find -exec ...`, `sudo`, `sudo -l`, `crontab -l`, `getcap`, `strings`, `chmod`, `echo`, `echo >`, `echo >>`, `export`, `python3 -c '...'`, `vim`, `whoami`, `id`, `wait`, plus meta commands.

## Language

Toggle EN/FR from the top-right, or type `lang fr`.

## Structure

```
privesc-game/
├── index.html         # Entry point
├── styles.css         # Kali/Parrot-inspired terminal styling
└── js/
    ├── i18n.js        # Bilingual dictionary
    ├── levels.js      # 5 machines with their filesystems
    ├── fs.js          # Simulated filesystem
    ├── commands.js    # Command interpreter
    ├── terminal.js    # Terminal UI (history, prompt, rendering)
    └── main.js        # Game orchestration
```

## License

MIT — do whatever. Educational content, no real systems harmed.
