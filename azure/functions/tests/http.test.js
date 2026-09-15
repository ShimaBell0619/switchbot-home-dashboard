const assert = require("node:assert/strict");
const test = require("node:test");

const { createHistoryHandler } = require("../history");
const { createLatestHandler } = require("../latest");
const { createStoryHandler } = require("../story");

function context() {
  return {
    log: {
      error() {},
    },
    res: undefined,
  };
}

function parseBody(res) {
  return JSON.parse(res.body);
}

test("latest reports not configured without fabricating a reading", async () => {
  const handler = createLatestHandler({ env: {} });
  const ctx = context();

  await handler(ctx);

  assert.equal(ctx.res.status, 503);
  assert.equal(parseBody(ctx.res).status, "not_configured");
});

test("latest reports no data when CurrentState has no entity", async () => {
  const handler = createLatestHandler({
    env: { SWITCHBOT_DEVICE_ID: "ABC123", STALE_AFTER_SECONDS: "900" },
    getTableConfigFn: () => ({
      accountName: "example",
      currentTableName: "CurrentState",
      currentTableSas: "sas",
    }),
    getEntityFn: async () => null,
  });
  const ctx = context();

  await handler(ctx);

  assert.equal(ctx.res.status, 404);
  assert.equal(parseBody(ctx.res).status, "no_data");
});

test("latest returns stored data with explicit freshness", async () => {
  const handler = createLatestHandler({
    env: { SWITCHBOT_DEVICE_ID: "ABC123", STALE_AFTER_SECONDS: "900" },
    getTableConfigFn: () => ({
      accountName: "example",
      currentTableName: "CurrentState",
      currentTableSas: "sas",
    }),
    getEntityFn: async () => ({
      PartitionKey: "ABC123",
      RowKey: "current",
      observedAt: "2026-09-14T12:00:00.000Z",
      temperature: 24.6,
      humidity: 51,
    }),
    freshnessFn: () => ({ ageSeconds: 60, stale: false }),
  });
  const ctx = context();

  await handler(ctx);

  assert.equal(ctx.res.status, 200);
  const body = parseBody(ctx.res);
  assert.equal(body.status, "ok");
  assert.equal(body.data.temperature, 24.6);
  assert.deepEqual(body.freshness, { ageSeconds: 60, stale: false });
});

test("history rejects an unapproved unbounded window", async () => {
  const handler = createHistoryHandler({ env: { SWITCHBOT_DEVICE_ID: "ABC123" } });
  const ctx = context();

  await handler(ctx, { query: { window: "7d" } });

  assert.equal(ctx.res.status, 400);
  assert.equal(parseBody(ctx.res).status, "invalid_request");
});

test("history returns only rows inside the requested bounded window", async () => {
  const rows = [
    { observedAt: "2026-09-14T11:30:00.000Z", temperature: 24.6, humidity: 51 },
    { observedAt: "2026-09-14T05:00:00.000Z", temperature: 23.1, humidity: 55 },
  ];
  const handler = createHistoryHandler({
    env: { SWITCHBOT_DEVICE_ID: "ABC123" },
    now: () => Date.parse("2026-09-14T12:00:00.000Z"),
    getTableConfigFn: () => ({
      accountName: "example",
      historyTableName: "SensorReadings",
      historyTableSas: "sas",
    }),
    queryRecentEntitiesFn: async () => rows,
  });
  const ctx = context();

  await handler(ctx, { query: { window: "1h" } });

  assert.equal(ctx.res.status, 200);
  const body = parseBody(ctx.res);
  assert.equal(body.count, 1);
  assert.equal(body.data[0].temperature, 24.6);
});

test("story returns today's generated narrative with freshness", async () => {
  const rows = [
    {
      observedAt: "2026-09-15T01:00:00.000Z",
      temperature: 28,
      humidity: 55,
      co2: 500,
    },
    {
      observedAt: "2026-09-15T01:20:00.000Z",
      temperature: 28.1,
      humidity: 55,
      co2: 760,
    },
  ];
  const handler = createStoryHandler({
    env: { SWITCHBOT_DEVICE_ID: "ABC123", STALE_AFTER_SECONDS: "900" },
    now: () => Date.parse("2026-09-15T02:00:00.000Z"),
    getTableConfigFn: () => ({
      accountName: "example",
      historyTableName: "SensorReadings",
      historyTableSas: "sas",
    }),
    queryRecentEntitiesFn: async () => rows,
    freshnessFn: () => ({ ageSeconds: 60, stale: false }),
  });
  const ctx = context();

  await handler(ctx);

  assert.equal(ctx.res.status, 200);
  const body = parseBody(ctx.res);
  assert.equal(body.status, "ok");
  assert.equal(body.data.kind, "events");
  assert.equal(body.data.events[0].type, "co2_rise");
  assert.deepEqual(body.freshness, { ageSeconds: 60, stale: false });
});

test("story keeps a calm day distinct from a no-data day", async () => {
  const common = {
    env: { SWITCHBOT_DEVICE_ID: "ABC123" },
    now: () => Date.parse("2026-09-15T02:00:00.000Z"),
    getTableConfigFn: () => ({
      accountName: "example",
      historyTableName: "SensorReadings",
      historyTableSas: "sas",
    }),
  };

  const calmHandler = createStoryHandler({
    ...common,
    queryRecentEntitiesFn: async () => [
      { observedAt: "2026-09-15T01:00:00.000Z", temperature: 28, humidity: 55, co2: 620 },
      { observedAt: "2026-09-15T01:30:00.000Z", temperature: 28.1, humidity: 56, co2: 640 },
    ],
  });
  const calmContext = context();
  await calmHandler(calmContext);
  assert.equal(calmContext.res.status, 200);
  assert.equal(parseBody(calmContext.res).data.kind, "calm");

  const emptyHandler = createStoryHandler({ ...common, queryRecentEntitiesFn: async () => [] });
  const emptyContext = context();
  await emptyHandler(emptyContext);
  assert.equal(emptyContext.res.status, 404);
  assert.equal(parseBody(emptyContext.res).status, "no_data");
});
