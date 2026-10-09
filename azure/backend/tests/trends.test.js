const assert = require("node:assert/strict");
const test = require("node:test");
const { createSevenDayTrend } = require("../shared/trends");
const { createTrendsHandler } = require("../trends");

const NOW = Date.parse("2026-10-10T03:00:00.000Z"); // 12:00 JST

function context() {
  return { log: { error() {} }, res: undefined };
}

test("seven JST calendar days are ordered and do not fabricate observations", () => {
  const result = createSevenDayTrend([
    { observedAt: "2026-10-03T14:59:59.000Z", co2: 9999 },
    { observedAt: "2026-10-03T15:00:00.000Z", co2: 800, temperature: 21.5, humidity: 58 },
    { observedAt: "2026-10-09T14:59:59.000Z", co2: 750, temperature: 23.5 },
    { observedAt: "2026-10-09T15:01:00.000Z", co2: 620, temperature: 24.2, humidity: 49 },
    { observedAt: "2026-10-10T03:01:00.000Z", co2: 9999 },
    { observedAt: "invalid", co2: 9999 },
  ], NOW);

  assert.equal(result.timezone, "Asia/Tokyo");
  assert.equal(result.days.length, 7);
  assert.equal(result.days[0].date, "2026-10-04");
  assert.equal(result.days[0].observations, 1);
  assert.deepEqual(result.days[0].stats.co2, { min: 800, max: 800 });
  assert.equal(result.days[1].observations, 0);
  assert.equal(result.days[1].stats.co2, null);
  assert.equal(result.days[5].date, "2026-10-09");
  assert.equal(result.days[6].date, "2026-10-10");
  assert.equal(result.days[6].isToday, true);
  assert.equal(result.days[6].observations, 1);
  assert.equal(result.totalObservations, 3 + 1);
  assert.equal(result.observedDays, 3);
});

test("missing, null or invalid metrics do not create artificial zero readings", () => {
  const result = createSevenDayTrend([
    { observedAt: "2026-10-10T01:00:00.000Z", co2: null, temperature: 20, humidity: "40" },
    { observedAt: "2026-10-10T02:00:00.000Z", temperature: 24.62, humidity: 57 },
  ], NOW);
  const day = result.days.at(-1);
  assert.equal(day.observations, 2);
  assert.equal(day.stats.co2, null);
  assert.deepEqual(day.stats.temperature, { min: 20, max: 24.6 });
  assert.deepEqual(day.stats.humidity, { min: 57, max: 57 });
});

test("trend API returns summaries, not raw readings or credentials", async () => {
  let params;
  const handler = createTrendsHandler({
    env: { SWITCHBOT_DEVICE_ID: "ABC123" },
    now: () => NOW,
    getTableConfigFn: () => ({
      accountName: "example",
      historyTableName: "SensorReadings",
      historyTableSas: "secret-sas-not-for-output",
    }),
    querySevenDayEntitiesFn: async (options) => {
      params = options;
      return [{ observedAt: "2026-10-10T02:00:00.000Z", co2: 650, deviceId: "ABC123" }];
    },
  });
  const ctx = context();
  await handler(ctx);
  const body = JSON.parse(ctx.res.body);
  assert.equal(ctx.res.status, 200);
  assert.equal(params.sinceMs, Date.parse("2026-10-03T15:00:00.000Z"));
  assert.equal(body.data.days.at(-1).stats.co2.max, 650);
  assert.equal(body.data.totalObservations, 1);
  assert.doesNotMatch(ctx.res.body, /ABC123|secret-sas-not-for-output|observedAt/);
});

test("trend API fails closed rather than publishing incomplete daily aggregates", async () => {
  const handler = createTrendsHandler({
    env: { SWITCHBOT_DEVICE_ID: "ABC123" },
    now: () => NOW,
    getTableConfigFn: () => ({
      accountName: "example",
      historyTableName: "SensorReadings",
      historyTableSas: "secret-sas",
    }),
    querySevenDayEntitiesFn: async () => {
      throw new Error("Table trends query exceeded the bounded observation limit");
    },
  });
  const ctx = context();
  await handler(ctx);
  assert.equal(ctx.res.status, 502);
  assert.equal(JSON.parse(ctx.res.body).status, "backend_error");
  assert.doesNotMatch(ctx.res.body, /secret-sas/);
});
