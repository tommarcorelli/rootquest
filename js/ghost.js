// ghost.js — records the command log a ghost replay is built from.
//
// Every command actually run gets timestamped (ms since the level started)
// into SESSION.cmdLog. When a run beats the stored best time, main.js's
// renderStats() snapshots that log into GAME.ghosts[levelId] — this file
// only handles the recording side; playback (GAME.playGhost) lives in
// main.js since it needs the terminal/UI.
window.GHOST = {
    // Compresses the gaps between recorded commands so a replay is watchable
    // even if the original run had the player pause for a long time between
    // two commands (reading a man page, thinking) — pure function, no DOM,
    // easy to test in isolation. `capMs` is the longest any single gap is
    // allowed to be in the compressed output; relative order and every
    // command are always preserved.
    compressGaps(log, capMs) {
        if (!Array.isArray(log) || !log.length) return [];
        const out = [];
        let prevDt = 0;
        let cursor = 0;
        for (const entry of log) {
            const gap = Math.max(0, entry.dt - prevDt);
            cursor += Math.min(gap, capMs);
            out.push({ cmd: entry.cmd, dt: cursor });
            prevDt = entry.dt;
        }
        return out;
    }
};

if (window.CMD && window.CMD.execute) {
    const _origExecute = window.CMD.execute.bind(window.CMD);
    window.CMD.execute = function(raw) {
        const out = _origExecute(raw);
        try {
            if (window.SESSION && !SESSION.ghostReplaying && raw && raw.trim()) {
                if (!Array.isArray(SESSION.cmdLog)) SESSION.cmdLog = [];
                SESSION.cmdLog.push({ cmd: raw, dt: Date.now() - (SESSION.startTime || Date.now()) });
            }
        } catch (e) { /* recording is best-effort, never breaks the game */ }
        return out;
    };
}
