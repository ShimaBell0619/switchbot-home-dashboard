const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createHomeStory,
  detectStoryEvents,
  filterTodayReadings,
} = require("../shared/story");

function reading(iso, { co2, temperature = 28, humidity = 55 } = {}) {
  return {
    observedAt: iso,
    ...(co2 === undefined ? {} : { co2 }),
    temperature,
    humidity,
  };
}

const now = Date.parse("2026-09-15T12:00:00.000Z"); // 21:00 JST

test("stable readings produce a calm story without invented events", () => {
  const rows = [
    reading("2026-09-15T00:00:00.000Z", { co2: 610, temperature: 27.9, humidity: 55 }),
    reading("2026-09-15T01:00:00.000Z", { co2: 640, temperature: 28.1, humidity: 56 }),
    reading("2026-09-15T02:00:00.000Z", { co2: 620, temperature: 28.2, humidity: 55 }),
  ];

  const story = createHomeStory(rows, now);

  assert.equal(story.kind, "calm");
  assert.equal(story.events.length, 0);
  assert.equal(story.summary, "今日は今のところ穏やかです");
  assert.deepEqual(story.stats.co2, { min: 610, max: 640 });
});

test("one meaningful change stays one event instead of padding the story", () => {
  const rows = [
    reading("2026-09-15T01:00:00.000Z", { temperature: 26.4, humidity: 55 }),
    reading("2026-09-15T01:45:00.000Z", { temperature: 27.6, humidity: 55 }),
  ];

  const story = createHomeStory(rows, now);

  assert.equal(story.kind, "events");
  assert.equal(story.events.length, 1);
  assert.equal(story.events[0].type, "temperature_rise");
});

test("adjacent rapid CO2 rises consolidate to the strongest event", () => {
  const rows = [
    reading("2026-09-15T01:00:00.000Z", { co2: 500 }),
    reading("2026-09-15T01:10:00.000Z", { co2: 650 }),
    reading("2026-09-15T01:20:00.000Z", { co2: 760 }),
    reading("2026-09-15T01:25:00.000Z", { co2: 820 }),
  ];

  const rises = detectStoryEvents(rows).filter((event) => event.type === "co2_rise");

  assert.equal(rises.length, 1);
  assert.equal(rises[0].detail, "500 → 820 ppm");
});

test("high CO2 requires sustained observations and does not add a nearby peak duplicate", () => {
  const rows = [
    reading("2026-09-15T01:00:00.000Z", { co2: 990 }),
    reading("2026-09-15T01:05:00.000Z", { co2: 1010 }),
    reading("2026-09-15T01:10:00.000Z", { co2: 1040 }),
    reading("2026-09-15T01:15:00.000Z", { co2: 1070 }),
  ];

  const events = detectStoryEvents(rows);

  assert.equal(events.filter((event) => event.type === "co2_high").length, 1);
  assert.equal(events.filter((event) => event.type === "co2_peak").length, 0);
});

test("an eventful day is capped at four selected story events", () => {
  const rows = [
    reading("2026-09-15T01:00:00.000Z", { co2: 500, temperature: 25, humidity: 50 }),
    reading("2026-09-15T01:20:00.000Z", { co2: 800, temperature: 25.2, humidity: 50 }),
    reading("2026-09-15T01:40:00.000Z", { co2: 1050, temperature: 26.3, humidity: 59 }),
    reading("2026-09-15T01:45:00.000Z", { co2: 1100, temperature: 26.4, humidity: 59 }),
    reading("2026-09-15T01:50:00.000Z", { co2: 1150, temperature: 26.5, humidity: 59 }),
    reading("2026-09-15T02:20:00.000Z", { co2: 700, temperature: 26.5, humidity: 48 }),
  ];

  const events = detectStoryEvents(rows);

  assert.equal(events.length, 4);
  assert.ok(events.every((event, index) => index === 0 || events[index - 1].occurredAt <= event.occurredAt));
});

test("legacy readings without CO2 still support temperature and humidity story data", () => {
  const rows = [
    reading("2026-09-15T01:00:00.000Z", { temperature: 26.5, humidity: 50 }),
    reading("2026-09-15T01:40:00.000Z", { temperature: 27.7, humidity: 59 }),
  ];

  const story = createHomeStory(rows, now);

  assert.equal(story.stats.co2, null);
  assert.ok(story.events.some((event) => event.type === "temperature_rise"));
  assert.ok(story.events.some((event) => event.type === "humidity_rise"));
});

test("rows from the previous JST day do not leak into today's story", () => {
  const rows = [
    reading("2026-09-14T14:59:00.000Z", { co2: 1200 }), // 23:59 JST Sep 14
    reading("2026-09-14T15:05:00.000Z", { co2: 600 }), // 00:05 JST Sep 15
  ];

  const filtered = filterTodayReadings(rows, now);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].co2, 600);
});

test("no observations today remains a no-data state", () => {
  const story = createHomeStory(
    [reading("2026-09-14T12:00:00.000Z", { co2: 600 })],
    now,
  );

  assert.equal(story.kind, "no_data");
  assert.equal(story.observations, 0);
});
