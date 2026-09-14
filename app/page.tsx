import { getDashboardState, type SensorReading } from "@/lib/backend";

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function formatObservedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date);
}

function ReadingValues({ reading }: { reading: SensorReading }) {
  return (
    <dl className="mt-5 flex flex-wrap items-end gap-x-10 gap-y-4">
      <div>
        <dt className="text-sm text-muted">温度</dt>
        <dd className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
          {reading.temperature.toFixed(1)}
          <span className="ml-1 text-xl font-medium">℃</span>
        </dd>
      </div>
      <div>
        <dt className="text-sm text-muted">湿度</dt>
        <dd className="mt-1 text-2xl font-semibold">
          {reading.humidity}
          <span className="ml-1 text-base font-medium">%</span>
        </dd>
      </div>
      {reading.battery !== undefined ? (
        <div>
          <dt className="text-sm text-muted">バッテリー</dt>
          <dd className="mt-1 text-lg font-medium">{reading.battery}%</dd>
        </div>
      ) : null}
    </dl>
  );
}

function HistoryRows({ readings }: { readings: SensorReading[] }) {
  return (
    <>
      <ul className="mt-5 divide-y divide-border sm:hidden" aria-label="最近のセンサー履歴">
        {readings.map((reading) => (
          <li key={`${reading.deviceId}-${reading.observedAt}`} className="py-4 first:pt-0">
            <p className="text-sm font-medium">{formatObservedAt(reading.observedAt)}</p>
            <dl className="mt-2 grid grid-cols-3 gap-x-3 text-sm">
              <div>
                <dt className="text-muted">温度</dt>
                <dd className="mt-1 font-medium">{reading.temperature.toFixed(1)}℃</dd>
              </div>
              <div>
                <dt className="text-muted">湿度</dt>
                <dd className="mt-1 font-medium">{reading.humidity}%</dd>
              </div>
              <div>
                <dt className="text-muted">バッテリー</dt>
                <dd className="mt-1 font-medium">
                  {reading.battery === undefined ? "—" : `${reading.battery}%`}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <table className="mt-5 hidden w-full border-collapse text-left text-sm sm:table">
        <thead className="text-muted">
          <tr className="border-b border-border">
            <th className="py-2 pr-4 font-medium">観測時刻</th>
            <th className="px-4 py-2 font-medium">温度</th>
            <th className="px-4 py-2 font-medium">湿度</th>
            <th className="py-2 pl-4 font-medium">バッテリー</th>
          </tr>
        </thead>
        <tbody>
          {readings.map((reading) => (
            <tr
              key={`${reading.deviceId}-${reading.observedAt}`}
              className="border-b border-border/70"
            >
              <td className="py-3 pr-4">{formatObservedAt(reading.observedAt)}</td>
              <td className="px-4 py-3">{reading.temperature.toFixed(1)}℃</td>
              <td className="px-4 py-3">{reading.humidity}%</td>
              <td className="py-3 pl-4">
                {reading.battery === undefined ? "—" : `${reading.battery}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default async function Home() {
  const state = await getDashboardState();

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-14 sm:px-10 sm:py-20">
      <header>
        <p className="text-sm font-medium text-muted">Architecture PoC</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          SwitchBot Home Dashboard
        </h1>
      </header>

      {state.kind === "web_not_configured" ? (
        <section className="mt-12 border-t border-border pt-7" aria-labelledby="setup-heading">
          <h2 id="setup-heading" className="text-xl font-semibold">
            Web接続設定待ち
          </h2>
          <p className="mt-3 leading-7 text-muted">
            Azure Functions のURLがWeb側へまだ設定されていません。UIはSwitchBotへ直接接続しません。
          </p>
        </section>
      ) : null}

      {state.kind === "collector_not_configured" ? (
        <section className="mt-12 border-t border-border pt-7" aria-labelledby="collector-heading">
          <h2 id="collector-heading" className="text-xl font-semibold">
            Azure read path 接続済み
          </h2>
          <p className="mt-3 leading-7 text-muted">
            保存先とWeb APIには到達できています。SwitchBotの収集資格情報をAzure側へ設定すると収集を開始できます。
          </p>
        </section>
      ) : null}

      {state.kind === "no_data" ? (
        <section className="mt-12 border-t border-border pt-7" aria-labelledby="empty-heading">
          <h2 id="empty-heading" className="text-xl font-semibold">
            収集データ待ち
          </h2>
          <p className="mt-3 leading-7 text-muted">
            Collectorは設定済みですが、まだ有効なセンサーデータが保存されていません。
          </p>
        </section>
      ) : null}

      {state.kind === "error" ? (
        <section className="mt-12 border-t border-border pt-7" aria-labelledby="error-heading">
          <h2 id="error-heading" className="text-xl font-semibold">
            保存済みデータを取得できません
          </h2>
          <p className="mt-3 leading-7 text-muted">{state.message}</p>
        </section>
      ) : null}

      {state.kind === "ready" ? (
        <>
          <section className="mt-12 border-t border-border pt-7" aria-labelledby="latest-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <h2 id="latest-heading" className="text-xl font-semibold">
                最新の記録
              </h2>
              <p className="text-sm text-muted">
                {state.freshness.stale ? "古いデータです" : "最新性は正常です"}
              </p>
            </div>
            <ReadingValues reading={state.latest} />
            <p className="mt-5 text-sm text-muted">
              観測 {formatObservedAt(state.latest.observedAt)}
              {state.freshness.ageSeconds !== null
                ? ` · ${Math.floor(state.freshness.ageSeconds / 60)}分前`
                : ""}
            </p>
          </section>

          <section className="mt-12 border-t border-border pt-7" aria-labelledby="history-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <h2 id="history-heading" className="text-xl font-semibold">
                最近の履歴
              </h2>
              <p className="text-sm text-muted">
                24時間 · {state.historyCount}件
                {state.historyCount > 12 ? "中 直近12件を表示" : ""}
              </p>
            </div>

            {state.historyError ? (
              <p className="mt-4 leading-7 text-muted">
                最新値は取得できましたが、履歴の読み取りに失敗しました。
              </p>
            ) : state.history.length === 0 ? (
              <p className="mt-4 leading-7 text-muted">表示できる履歴はまだありません。</p>
            ) : (
              <HistoryRows readings={state.history.slice(0, 12)} />
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
