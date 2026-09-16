import { readDirectDashboardState } from "@/lib/direct-table";

export type StoryMetricRange = {
  min: number;
  max: number;
};

export type StoryEvent = {
  type: string;
  metric: string;
  occurredAt: string;
  title: string;
  detail: string;
};

export type HomeStory = {
  kind: "events" | "calm";
  date: string;
  summary: string;
  observations: number;
  latestObservedAt: string;
  events: StoryEvent[];
  stats: {
    co2: StoryMetricRange | null;
    temperature: StoryMetricRange | null;
    humidity: StoryMetricRange | null;
  };
};

export type DashboardState =
  | { kind: "web_not_configured" }
  | { kind: "collector_not_configured" }
  | { kind: "no_data" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      story: HomeStory;
      freshness: { ageSeconds: number | null; stale: boolean };
    };

type ApiBody = Record<string, unknown>;
type Dependencies = { fetchImpl?: typeof fetch; now?: () => number };

function apiBaseUrl(env = process.env) {
  return String(env.AZURE_BACKEND_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
}

async function readBody(response: Response): Promise<ApiBody> {
  const body = await response.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error(`Backend returned an invalid JSON body (HTTP ${response.status}).`);
  }
  return body as ApiBody;
}

function parseRange(value: unknown): StoryMetricRange | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Backend story range has an invalid shape.");
  }
  const range = value as Record<string, unknown>;
  if (typeof range.min !== "number" || typeof range.max !== "number") {
    throw new Error("Backend story range has an invalid shape.");
  }
  return { min: range.min, max: range.max };
}

function parseEvent(value: unknown): StoryEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Backend story event is missing.");
  }
  const event = value as Record<string, unknown>;
  if (
    typeof event.type !== "string" ||
    typeof event.metric !== "string" ||
    typeof event.occurredAt !== "string" ||
    typeof event.title !== "string" ||
    typeof event.detail !== "string"
  ) {
    throw new Error("Backend story event has an invalid shape.");
  }
  return event as StoryEvent;
}

function parseStory(value: unknown): HomeStory {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Backend story is missing.");
  }
  const story = value as Record<string, unknown>;
  if (
    (story.kind !== "events" && story.kind !== "calm") ||
    typeof story.date !== "string" ||
    typeof story.summary !== "string" ||
    typeof story.observations !== "number" ||
    typeof story.latestObservedAt !== "string" ||
    !Array.isArray(story.events) ||
    !story.stats ||
    typeof story.stats !== "object" ||
    Array.isArray(story.stats)
  ) {
    throw new Error("Backend story has an invalid shape.");
  }

  const stats = story.stats as Record<string, unknown>;
  return {
    kind: story.kind,
    date: story.date,
    summary: story.summary,
    observations: story.observations,
    latestObservedAt: story.latestObservedAt,
    events: story.events.map(parseEvent),
    stats: {
      co2: parseRange(stats.co2),
      temperature: parseRange(stats.temperature),
      humidity: parseRange(stats.humidity),
    },
  };
}

function parseFreshness(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Backend freshness data is missing.");
  }
  const freshness = value as Record<string, unknown>;
  if (
    !(typeof freshness.ageSeconds === "number" || freshness.ageSeconds === null) ||
    typeof freshness.stale !== "boolean"
  ) {
    throw new Error("Backend freshness data has an invalid shape.");
  }
  return freshness as { ageSeconds: number | null; stale: boolean };
}

export async function getDashboardState(
  env = process.env,
  dependencies: Dependencies = {},
): Promise<DashboardState> {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? Date.now;

  try {
    const directState = (await readDirectDashboardState({ env, fetchImpl, now })) as
      | DashboardState
      | null;
    if (directState) return directState;

    const baseUrl = apiBaseUrl(env);
    if (!baseUrl) return { kind: "web_not_configured" };

    const response = await fetchImpl(`${baseUrl}/api/story`, { cache: "no-store" });
    const body = await readBody(response);

    if (response.status === 503 && body.status === "not_configured") {
      return { kind: "collector_not_configured" };
    }
    if (response.status === 404 && body.status === "no_data") {
      return { kind: "no_data" };
    }
    if (!response.ok || body.status !== "ok") {
      return { kind: "error", message: "今日のストーリーを取得できませんでした。" };
    }

    return {
      kind: "ready",
      story: parseStory(body.data),
      freshness: parseFreshness(body.freshness),
    };
  } catch {
    return { kind: "error", message: "Azure の保存済みデータへ接続できませんでした。" };
  }
}
