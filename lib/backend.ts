export type SensorReading = {
  deviceId: string;
  deviceType: string;
  temperature: number;
  humidity: number;
  battery?: number;
  observedAt: string;
  collectedAt: string;
  sourceTimestampKind: string;
};

export type DashboardState =
  | { kind: "web_not_configured" }
  | { kind: "collector_not_configured" }
  | { kind: "no_data" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      latest: SensorReading;
      freshness: { ageSeconds: number | null; stale: boolean };
      history: SensorReading[];
      historyCount: number;
      historyError: boolean;
    };

type ApiBody = Record<string, unknown>;

function apiBaseUrl(env = process.env) {
  return String(env.AZURE_FUNCTIONS_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

async function readBody(response: Response): Promise<ApiBody> {
  const body = await response.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(`Backend returned an invalid JSON body (HTTP ${response.status}).`);
  }
  return body as ApiBody;
}

function parseReading(value: unknown): SensorReading {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Backend reading is missing.");
  }
  const reading = value as Record<string, unknown>;
  if (
    typeof reading.deviceId !== "string" ||
    typeof reading.deviceType !== "string" ||
    typeof reading.temperature !== "number" ||
    typeof reading.humidity !== "number" ||
    typeof reading.observedAt !== "string" ||
    typeof reading.collectedAt !== "string" ||
    typeof reading.sourceTimestampKind !== "string"
  ) {
    throw new Error("Backend reading has an invalid shape.");
  }
  if (reading.battery !== undefined && typeof reading.battery !== "number") {
    throw new Error("Backend battery value has an invalid shape.");
  }
  return reading as SensorReading;
}

export async function getDashboardState(env = process.env): Promise<DashboardState> {
  const baseUrl = apiBaseUrl(env);
  if (!baseUrl) return { kind: "web_not_configured" };

  try {
    const latestResponse = await fetch(`${baseUrl}/api/latest`, { cache: "no-store" });
    const latestBody = await readBody(latestResponse);

    if (latestResponse.status === 503 && latestBody.status === "not_configured") {
      return { kind: "collector_not_configured" };
    }
    if (latestResponse.status === 404 && latestBody.status === "no_data") {
      return { kind: "no_data" };
    }
    if (!latestResponse.ok || latestBody.status !== "ok") {
      return { kind: "error", message: "最新データを取得できませんでした。" };
    }

    const latest = parseReading(latestBody.data);
    const freshnessValue = latestBody.freshness;
    if (!freshnessValue || typeof freshnessValue !== "object" || Array.isArray(freshnessValue)) {
      throw new Error("Backend freshness data is missing.");
    }
    const freshness = freshnessValue as Record<string, unknown>;
    if (
      !(typeof freshness.ageSeconds === "number" || freshness.ageSeconds === null) ||
      typeof freshness.stale !== "boolean"
    ) {
      throw new Error("Backend freshness data has an invalid shape.");
    }

    const historyResponse = await fetch(`${baseUrl}/api/history?window=24h`, { cache: "no-store" });
    if (!historyResponse.ok) {
      return {
        kind: "ready",
        latest,
        freshness: freshness as { ageSeconds: number | null; stale: boolean },
        history: [],
        historyCount: 0,
        historyError: true,
      };
    }

    const historyBody = await readBody(historyResponse);
    if (historyBody.status !== "ok" || !Array.isArray(historyBody.data)) {
      throw new Error("Backend history data has an invalid shape.");
    }
    const history = historyBody.data.map(parseReading);

    return {
      kind: "ready",
      latest,
      freshness: freshness as { ageSeconds: number | null; stale: boolean },
      history,
      historyCount: typeof historyBody.count === "number" ? historyBody.count : history.length,
      historyError: false,
    };
  } catch {
    return { kind: "error", message: "Azure の保存済みデータへ接続できませんでした。" };
  }
}
