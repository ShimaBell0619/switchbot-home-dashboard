const WINDOWS = Object.freeze({
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
});

function parseHistoryWindow(value) {
  const normalized = String(value ?? "24h").trim();
  if (!Object.hasOwn(WINDOWS, normalized)) {
    const error = new Error("History window must be one of: 1h, 6h, 24h");
    error.code = "INVALID_HISTORY_WINDOW";
    throw error;
  }
  return { name: normalized, milliseconds: WINDOWS[normalized] };
}

function filterHistoryWindow(rows, window, now = Date.now()) {
  const cutoff = now - window.milliseconds;
  return rows.filter((row) => {
    const observedAt = Date.parse(row.observedAt);
    return Number.isFinite(observedAt) && observedAt >= cutoff && observedAt <= now;
  });
}

function freshness(observedAt, staleAfterSeconds = 900, now = Date.now()) {
  const observedAtMs = Date.parse(observedAt);
  if (!Number.isFinite(observedAtMs)) {
    return { ageSeconds: null, stale: true };
  }
  const ageSeconds = Math.max(0, Math.floor((now - observedAtMs) / 1000));
  return {
    ageSeconds,
    stale: ageSeconds > staleAfterSeconds,
  };
}

module.exports = { filterHistoryWindow, freshness, parseHistoryWindow };
