const assert = require("node:assert/strict");
const test = require("node:test");

const { filterHistoryWindow, freshness, parseHistoryWindow } = require("../shared/history");

test("accepts only bounded history windows", () => {
  assert.deepEqual(parseHistoryWindow(undefined), { name: "24h", milliseconds: 86_400_000 });
  assert.deepEqual(parseHistoryWindow("1h"), { name: "1h", milliseconds: 3_600_000 });
  assert.throws(() => parseHistoryWindow("7d"), /1h, 6h, 24h/);
});

test("filters rows to the requested recent window", () => {
  const now = Date.parse("2026-09-14T12:00:00.000Z");
  const rows = [
    { observedAt: "2026-09-14T11:30:00.000Z" },
    { observedAt: "2026-09-14T05:00:00.000Z" },
  ];
  assert.deepEqual(filterHistoryWindow(rows, parseHistoryWindow("1h"), now), [rows[0]]);
});

test("marks readings stale after the configured threshold", () => {
  const now = Date.parse("2026-09-14T12:20:00.000Z");
  assert.deepEqual(freshness("2026-09-14T12:10:00.000Z", 900, now), {
    ageSeconds: 600,
    stale: false,
  });
  assert.deepEqual(freshness("2026-09-14T12:00:00.000Z", 900, now), {
    ageSeconds: 1200,
    stale: true,
  });
});
