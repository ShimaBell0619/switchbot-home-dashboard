const { startOfTokyoDay, tokyoDateKey } = require("./story");

const DAY = 24 * 60 * 60 * 1000;
const DAYS = 7;

function summaryMetric(readings, metric) {
  const values = readings
    .map((reading) => reading?.[metric])
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  if (!values.length) return null;
  const digits = metric === "temperature" ? 1 : 0;
  const round = (value) => Number(value.toFixed(digits));
  return {
    min: round(Math.min(...values)),
    max: round(Math.max(...values)),
  };
}

function createSevenDayTrend(rows, nowMs = Date.now()) {
  const todayStart = startOfTokyoDay(nowMs);
  const firstDayStart = todayStart - (DAYS - 1) * DAY;
  const byDate = new Map();
  for (let index = 0; index < DAYS; index += 1) {
    byDate.set(tokyoDateKey(firstDayStart + index * DAY), []);
  }
  for (const row of rows) {
    const timestamp = Date.parse(row?.observedAt);
    if (!Number.isFinite(timestamp) || timestamp < firstDayStart || timestamp > nowMs) continue;
    const bucket = byDate.get(tokyoDateKey(timestamp));
    if (bucket) bucket.push(row);
  }
  const days = [...byDate.entries()].map(([date, readings], index) => ({
    date,
    isToday: index === DAYS - 1,
    observations: readings.length,
    stats: {
      co2: summaryMetric(readings, "co2"),
      temperature: summaryMetric(readings, "temperature"),
      humidity: summaryMetric(readings, "humidity"),
    },
  }));
  return {
    timezone: "Asia/Tokyo",
    days,
    observedDays: days.filter((day) => day.observations > 0).length,
    totalObservations: days.reduce((count, day) => count + day.observations, 0),
  };
}

module.exports = { createSevenDayTrend, summaryMetric };
