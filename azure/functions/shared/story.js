const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TOKYO_OFFSET_MS = 9 * HOUR;

const THRESHOLDS = Object.freeze({
  co2HighPpm: 1000,
  co2HighSamples: 3,
  co2RapidDelta: 200,
  co2RapidWindowMs: 30 * MINUTE,
  temperatureRise: 1.0,
  temperatureWindowMs: 60 * MINUTE,
  humidityDelta: 8,
  humidityWindowMs: 60 * MINUTE,
  mergeWindowMs: 60 * MINUTE,
});

function readingTime(reading) {
  const value = Date.parse(reading?.observedAt);
  return Number.isFinite(value) ? value : null;
}

function startOfTokyoDay(nowMs) {
  const shifted = nowMs + TOKYO_OFFSET_MS;
  return Math.floor(shifted / DAY) * DAY - TOKYO_OFFSET_MS;
}

function tokyoDateKey(nowMs) {
  return new Date(nowMs + TOKYO_OFFSET_MS).toISOString().slice(0, 10);
}

function filterTodayReadings(rows, nowMs = Date.now()) {
  const start = startOfTokyoDay(nowMs);
  return rows
    .filter((row) => {
      const time = readingTime(row);
      return time !== null && time >= start && time <= nowMs;
    })
    .sort((a, b) => readingTime(a) - readingTime(b));
}

function finiteMetric(reading, key) {
  const value = Number(reading?.[key]);
  return Number.isFinite(value) ? value : null;
}

function metricPoints(readings, key) {
  return readings.flatMap((reading) => {
    const time = readingTime(reading);
    const value = finiteMetric(reading, key);
    if (time === null || value === null) return [];
    return [{ time, value, observedAt: reading.observedAt }];
  });
}

function metricRange(readings, key, digits = 0) {
  const values = metricPoints(readings, key).map((point) => point.value);
  if (values.length === 0) return null;
  const factor = 10 ** digits;
  const round = (value) => Math.round(value * factor) / factor;
  return { min: round(Math.min(...values)), max: round(Math.max(...values)) };
}

function formatNumber(value, digits = 0) {
  return Number(value).toFixed(digits).replace(/\.0$/, "");
}

function windowCandidates(points, { type, metric, windowMs, threshold, direction, importance, title }) {
  const candidates = [];
  for (let endIndex = 1; endIndex < points.length; endIndex += 1) {
    const end = points[endIndex];
    let strongest = null;
    for (let startIndex = endIndex - 1; startIndex >= 0; startIndex -= 1) {
      const start = points[startIndex];
      const elapsed = end.time - start.time;
      if (elapsed <= 0) continue;
      if (elapsed > windowMs) break;
      const delta = end.value - start.value;
      const matches = direction === "rise" ? delta >= threshold : delta <= -threshold;
      if (!matches) continue;
      if (!strongest || Math.abs(delta) > Math.abs(strongest.delta)) {
        strongest = { start, end, delta };
      }
    }
    if (!strongest) continue;

    const digits = metric === "temperature" ? 1 : 0;
    const unit = metric === "co2" ? "ppm" : metric === "temperature" ? "℃" : "%";
    const detail =
      metric === "temperature"
        ? `${strongest.delta >= 0 ? "+" : ""}${formatNumber(strongest.delta, 1)}℃`
        : `${formatNumber(strongest.start.value, digits)} → ${formatNumber(strongest.end.value, digits)} ${unit}`;

    candidates.push({
      type,
      metric,
      occurredAt: strongest.end.observedAt,
      time: strongest.end.time,
      title,
      detail,
      importance,
      magnitude: Math.abs(strongest.delta),
    });
  }
  return candidates;
}

function co2HighCandidates(points) {
  const results = [];
  let run = [];
  const maxGapMs = 12 * MINUTE;

  const flush = () => {
    if (run.length >= THRESHOLDS.co2HighSamples) {
      const durationMs = run.at(-1).time - run[0].time;
      if (durationMs >= 10 * MINUTE) {
        const peak = run.reduce((best, point) => (point.value > best.value ? point : best), run[0]);
        const durationMinutes = Math.max(10, Math.round(durationMs / MINUTE));
        results.push({
          type: "co2_high",
          metric: "co2",
          occurredAt: run[0].observedAt,
          time: run[0].time,
          title: "CO₂が高めに",
          detail: `最大 ${formatNumber(peak.value)} ppm · ${durationMinutes}分以上`,
          importance: 100,
          magnitude: peak.value,
        });
      }
    }
    run = [];
  };

  for (const point of points) {
    const previous = run.at(-1);
    if (point.value >= THRESHOLDS.co2HighPpm) {
      if (previous && point.time - previous.time > maxGapMs) flush();
      run.push(point);
    } else if (run.length > 0) {
      flush();
    }
  }
  flush();
  return results;
}

function co2PeakCandidate(points) {
  if (points.length < 2) return [];
  const min = points.reduce((best, point) => (point.value < best.value ? point : best), points[0]);
  const max = points.reduce((best, point) => (point.value > best.value ? point : best), points[0]);
  const range = max.value - min.value;
  if (max.value < 900 && range < 300) return [];
  return [
    {
      type: "co2_peak",
      metric: "co2",
      occurredAt: max.observedAt,
      time: max.time,
      title: "今日の最高CO₂",
      detail: `${formatNumber(max.value)} ppm`,
      importance: 55,
      magnitude: max.value,
    },
  ];
}

function mergeSameType(candidates) {
  const groups = new Map();
  for (const candidate of [...candidates].sort((a, b) => a.time - b.time)) {
    const group = groups.get(candidate.type) ?? [];
    const previous = group.at(-1);
    if (previous && candidate.time - previous.endTime <= THRESHOLDS.mergeWindowMs) {
      previous.endTime = candidate.time;
      if (candidate.magnitude > previous.best.magnitude) previous.best = candidate;
    } else {
      group.push({ best: candidate, endTime: candidate.time });
    }
    groups.set(candidate.type, group);
  }
  return [...groups.values()].flatMap((group) => group.map((entry) => entry.best));
}

function removeRedundantCo2Candidates(candidates) {
  const ranked = [...candidates].sort(
    (a, b) => b.importance - a.importance || b.magnitude - a.magnitude,
  );
  const selected = [];
  for (const candidate of ranked) {
    const nearby = selected.find(
      (existing) =>
        existing.metric === "co2" &&
        candidate.metric === "co2" &&
        Math.abs(existing.time - candidate.time) <= 45 * MINUTE,
    );
    if (
      nearby &&
      (candidate.type === "co2_peak" ||
        (candidate.type === "co2_rise" && nearby.type === "co2_high"))
    ) {
      continue;
    }
    selected.push(candidate);
  }
  return selected;
}

function detectStoryEvents(readings) {
  const co2 = metricPoints(readings, "co2");
  const temperature = metricPoints(readings, "temperature");
  const humidity = metricPoints(readings, "humidity");

  const candidates = [
    ...co2HighCandidates(co2),
    ...windowCandidates(co2, {
      type: "co2_rise",
      metric: "co2",
      windowMs: THRESHOLDS.co2RapidWindowMs,
      threshold: THRESHOLDS.co2RapidDelta,
      direction: "rise",
      importance: 90,
      title: "CO₂が急上昇",
    }),
    ...windowCandidates(co2, {
      type: "co2_drop",
      metric: "co2",
      windowMs: THRESHOLDS.co2RapidWindowMs,
      threshold: THRESHOLDS.co2RapidDelta,
      direction: "drop",
      importance: 90,
      title: "CO₂が急低下",
    }),
    ...co2PeakCandidate(co2),
    ...windowCandidates(temperature, {
      type: "temperature_rise",
      metric: "temperature",
      windowMs: THRESHOLDS.temperatureWindowMs,
      threshold: THRESHOLDS.temperatureRise,
      direction: "rise",
      importance: 70,
      title: "気温が上昇",
    }),
    ...windowCandidates(humidity, {
      type: "humidity_rise",
      metric: "humidity",
      windowMs: THRESHOLDS.humidityWindowMs,
      threshold: THRESHOLDS.humidityDelta,
      direction: "rise",
      importance: 60,
      title: "湿度が上昇",
    }),
    ...windowCandidates(humidity, {
      type: "humidity_drop",
      metric: "humidity",
      windowMs: THRESHOLDS.humidityWindowMs,
      threshold: THRESHOLDS.humidityDelta,
      direction: "drop",
      importance: 60,
      title: "湿度が低下",
    }),
  ];

  const merged = mergeSameType(candidates);
  const deduped = removeRedundantCo2Candidates(merged);
  return deduped
    .sort((a, b) => b.importance - a.importance || b.magnitude - a.magnitude)
    .slice(0, 4)
    .sort((a, b) => a.time - b.time)
    .map(({ time: _time, magnitude: _magnitude, importance: _importance, ...event }) => event);
}

function storySummary(events) {
  if (events.some((event) => event.type === "co2_high")) {
    return "今日はCO₂が高くなる時間がありました";
  }
  if (events.some((event) => event.type === "co2_rise" || event.type === "co2_drop")) {
    return "今日は空気に変化がありました";
  }
  if (events.some((event) => event.type === "temperature_rise")) {
    return "今日は気温が上がる時間がありました";
  }
  if (events.some((event) => event.type.startsWith("humidity_"))) {
    return "今日は湿度に変化がありました";
  }
  if (events.length > 0) return "今日は小さな変化がありました";
  return "今日は今のところ穏やかです";
}

function createHomeStory(rows, nowMs = Date.now()) {
  const readings = filterTodayReadings(rows, nowMs);
  if (readings.length === 0) {
    return {
      kind: "no_data",
      date: tokyoDateKey(nowMs),
      observations: 0,
    };
  }

  const events = detectStoryEvents(readings);
  const latest = readings.at(-1);
  return {
    kind: events.length > 0 ? "events" : "calm",
    date: tokyoDateKey(nowMs),
    summary: storySummary(events),
    observations: readings.length,
    latestObservedAt: latest.observedAt,
    events,
    stats: {
      co2: metricRange(readings, "co2", 0),
      temperature: metricRange(readings, "temperature", 1),
      humidity: metricRange(readings, "humidity", 0),
    },
  };
}

module.exports = {
  THRESHOLDS,
  createHomeStory,
  detectStoryEvents,
  filterTodayReadings,
  startOfTokyoDay,
  tokyoDateKey,
};
