const assert = require("node:assert/strict");
const test = require("node:test");

const { createCollector } = require("../collectSensor");

function context() {
  const messages = { errors: [], warnings: [], info: [] };
  const log = (message) => messages.info.push(message);
  log.error = (message) => messages.errors.push(message);
  log.warn = (message) => messages.warnings.push(message);
  return { context: { log }, messages };
}

test("collector skips safely when SwitchBot configuration is incomplete", async () => {
  let saved = false;
  const { context: ctx, messages } = context();
  const collector = createCollector({
    env: { SWITCHBOT_TOKEN: "token" },
    saveReadingFn: async () => {
      saved = true;
    },
  });

  await collector(ctx);

  assert.equal(saved, false);
  assert.equal(messages.warnings.length, 1);
  assert.match(messages.warnings[0], /SWITCHBOT_SECRET/);
  assert.doesNotMatch(messages.warnings[0], /token/);
});

test("collector never writes fabricated state when the upstream request fails", async () => {
  let saveCalls = 0;
  const { context: ctx } = context();
  const collector = createCollector({
    env: {
      SWITCHBOT_TOKEN: "token",
      SWITCHBOT_SECRET: "secret",
      SWITCHBOT_DEVICE_ID: "ABC123",
    },
    fetchSensorStatusFn: async () => {
      throw new Error("upstream unavailable");
    },
    saveReadingFn: async () => {
      saveCalls += 1;
    },
  });

  await assert.rejects(collector(ctx), /upstream unavailable/);
  assert.equal(saveCalls, 0);
});

test("collector persists a validated reading with explicit collector time", async () => {
  let saved;
  const { context: ctx } = context();
  const collector = createCollector({
    env: {
      SWITCHBOT_TOKEN: "token",
      SWITCHBOT_SECRET: "secret",
      SWITCHBOT_DEVICE_ID: "ABC123",
    },
    now: () => new Date("2026-09-14T12:00:00.000Z"),
    fetchSensorStatusFn: async () => ({
      deviceId: "ABC123",
      deviceType: "MeterPro(CO2)",
      temperature: 24.6,
      humidity: 51,
      battery: 100,
      co2: 742,
    }),
    saveReadingFn: async (reading) => {
      saved = reading;
    },
  });

  await collector(ctx);

  assert.equal(saved.observedAt, "2026-09-14T12:00:00.000Z");
  assert.equal(saved.collectedAt, "2026-09-14T12:00:00.000Z");
  assert.equal(saved.sourceTimestampKind, "collector");
  assert.equal(saved.co2, 742);
});
