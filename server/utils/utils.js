function msToClock(ms) {
  const t = Math.max(0, ms|0);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(m)}:${pad(s)}`;
}

function sortLeaderboard(entries) {
  return entries.sort((a, b) => {
    if (a.bestLapMs == null && b.bestLapMs == null) return a.carNumber - b.carNumber;
    if (a.bestLapMs == null) return 1;
    if (b.bestLapMs == null) return -1;
    return a.bestLapMs - b.bestLapMs;
  });
}

function now() { return Date.now(); }

module.exports = { msToClock, sortLeaderboard, now };
