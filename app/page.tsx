import { getDashboardState, type StoryMetricRange } from "@/lib/backend";

export const dynamic = "force-dynamic";

const timeOnly = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : timeOnly.format(date);
}

function relativeFreshness(ageSeconds: number | null, stale: boolean) {
  if (ageSeconds === null) return "最終観測時刻を確認できません";
  if (stale) return `${Math.floor(ageSeconds / 60)}分前 · データが古くなっています`;
  if (ageSeconds < 60) return "たった今";
  return `${Math.floor(ageSeconds / 60)}分前`;
}

function RangeRow({
  label,
  range,
  unit,
  digits = 0,
}: {
  label: string;
  range: StoryMetricRange | null;
  unit: string;
  digits?: number;
}) {
  if (!range) return null;
  return (
    <div className="flex items-baseline justify-between gap-6 py-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right font-medium tabular-nums">
        {range.min.toFixed(digits)}–{range.max.toFixed(digits)} {unit}
      </dd>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <section className="mt-14 border-t border-border pt-7">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-prose leading-7 text-muted">{body}</p>
    </section>
  );
}

export default async function Home() {
  const state = await getDashboardState();

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-5 py-10 sm:px-8 sm:py-14">
      <header>
        <p className="text-sm font-medium tracking-wide text-muted">Home</p>
      </header>

      {state.kind === "web_not_configured" ? (
        <EmptyState
          title="Web接続設定待ち"
          body="Azure Functions のURLがWeb側へまだ設定されていません。UIはSwitchBotへ直接接続しません。"
        />
      ) : null}

      {state.kind === "collector_not_configured" ? (
        <EmptyState
          title="収集設定待ち"
          body="保存先とWeb APIには到達できています。SwitchBotの収集資格情報をAzure側へ設定すると今日のストーリーを作り始めます。"
        />
      ) : null}

      {state.kind === "no_data" ? (
        <EmptyState
          title="今日のデータ待ち"
          body="Collectorは設定済みですが、今日はまだ有効な観測データがありません。データが届くまで、安定した日としては扱いません。"
        />
      ) : null}

      {state.kind === "error" ? (
        <EmptyState title="今日のストーリーを取得できません" body={state.message} />
      ) : null}

      {state.kind === "ready" ? (
        <>
          <section className="mt-6" aria-labelledby="story-summary">
            <h1
              id="story-summary"
              className="max-w-[18ch] text-[2rem] font-semibold leading-[1.25] tracking-tight sm:text-4xl"
            >
              {state.story.summary}
            </h1>
            <p className="mt-3 text-sm text-muted">
              最終観測 {formatTime(state.story.latestObservedAt)} ·{" "}
              {relativeFreshness(state.freshness.ageSeconds, state.freshness.stale)}
            </p>
          </section>

          {state.story.kind === "events" ? (
            <section className="mt-14" aria-labelledby="today-heading">
              <h2 id="today-heading" className="text-sm font-medium text-muted">
                今日
              </h2>
              <ol className="relative mt-7 ml-1 border-l border-border">
                {state.story.events.map((event) => (
                  <li key={`${event.type}-${event.occurredAt}`} className="relative pb-10 pl-7 last:pb-0">
                    <span
                      className="absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full bg-foreground ring-4 ring-background"
                      aria-hidden="true"
                    />
                    <time
                      dateTime={event.occurredAt}
                      className="text-xs font-medium tabular-nums text-muted"
                    >
                      {formatTime(event.occurredAt)}頃
                    </time>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight">{event.title}</h3>
                    <p className="mt-1 text-base tabular-nums text-muted">{event.detail}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : (
            <section className="mt-14" aria-labelledby="calm-heading">
              <h2 id="calm-heading" className="text-sm font-medium text-muted">
                今日
              </h2>
              <p className="mt-7 text-lg font-medium">大きな変化はありませんでした</p>
              <dl className="mt-8 divide-y divide-border border-y border-border">
                <RangeRow label="CO₂" range={state.story.stats.co2} unit="ppm" />
                <RangeRow
                  label="温度"
                  range={state.story.stats.temperature}
                  unit="℃"
                  digits={1}
                />
                <RangeRow label="湿度" range={state.story.stats.humidity} unit="%" />
              </dl>
            </section>
          )}

          <footer className="mt-16 border-t border-border pt-5 text-xs text-muted">
            今日 {state.story.observations}件の観測から生成
          </footer>
        </>
      ) : null}
    </main>
  );
}
