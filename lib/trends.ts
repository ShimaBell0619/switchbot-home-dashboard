export type TrendRange = { min: number; max: number } | null;

export type TrendDay = {
  date: string;
  isToday: boolean;
  observations: number;
  stats: {
    co2: TrendRange;
    temperature: TrendRange;
    humidity: TrendRange;
  };
};

export type TrendData = {
  timezone: "Asia/Tokyo";
  observedDays: number;
  totalObservations: number;
  days: TrendDay[];
};

export type TrendState =
  | { kind: "ready"; data: TrendData }
  | { kind: "unavailable" }
  | { kind: "error" };

function isRange(value: unknown): value is TrendRange {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.min === "number" &&
    typeof item.max === "number" &&
    Number.isFinite(item.min) &&
    Number.isFinite(item.max) &&
    item.min <= item.max
  );
}

export function parseTrendData(value: unknown): TrendData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid trend data");
  }
  const input = value as Record<string, unknown>;
  if (
    input.timezone !== "Asia/Tokyo" ||
    !Array.isArray(input.days) ||
    input.days.length !== 7 ||
    typeof input.observedDays !== "number" ||
    typeof input.totalObservations !== "number" ||
    !Number.isInteger(input.observedDays) ||
    !Number.isInteger(input.totalObservations) ||
    input.observedDays < 0 ||
    input.observedDays > 7 ||
    input.totalObservations < 0
  ) {
    throw new Error("Invalid trend summary");
  }
  const days = input.days.map((entry: unknown): TrendDay => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Invalid trend day");
    }
    const day = entry as Record<string, unknown>;
    const stats = day.stats;
    if (
      typeof day.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
      typeof day.isToday !== "boolean" ||
      typeof day.observations !== "number" ||
      !Number.isInteger(day.observations) ||
      day.observations < 0 ||
      !stats ||
      typeof stats !== "object" ||
      Array.isArray(stats)
    ) {
      throw new Error("Invalid trend day");
    }
    const metrics = stats as Record<string, unknown>;
    if (!isRange(metrics.co2) || !isRange(metrics.temperature) || !isRange(metrics.humidity)) {
      throw new Error("Invalid trend metric");
    }
    return {
      date: day.date,
      isToday: day.isToday,
      observations: day.observations,
      stats: {
        co2: metrics.co2,
        temperature: metrics.temperature,
        humidity: metrics.humidity,
      },
    };
  });
  return {
    timezone: "Asia/Tokyo",
    days,
    observedDays: input.observedDays,
    totalObservations: input.totalObservations,
  };
}

export async function getTrendState(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<TrendState> {
  const base = String(env.AZURE_BACKEND_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) return { kind: "unavailable" };
  try {
    const response = await fetchImpl(`${base}/api/trends`, { cache: "no-store" });
    if (response.status === 404 || response.status === 503) return { kind: "unavailable" };
    if (!response.ok) return { kind: "error" };
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid response");
    const payload = body as Record<string, unknown>;
    if (payload.status !== "ok") throw new Error("Invalid status");
    return { kind: "ready", data: parseTrendData(payload.data) };
  } catch {
    return { kind: "error" };
  }
}
