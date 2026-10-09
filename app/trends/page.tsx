import Link from "next/link";
import { getTrendState, type TrendRange } from "@/lib/trends";

export const dynamic = "force-dynamic";

function formatDay(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function formatRange(range: TrendRange, unit: string, digits = 0) {
  if (!range) return "記録なし";
  return `${range.min.toFixed(digits)}–${range.max.toFixed(digits)} ${unit}`;
}

export default async function TrendsPage() {
  const state = await getTrendState();
  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex items-center justify-between gap-5">
        <p className="text-sm font-medium tracking-wide text-muted">Home</p>
        <nav aria-label="表示期間" className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-muted underline-offset-4 hover:underline focus-visible:underline">
            今日
          </Link>
          <span aria-current="page" className="font-semibold">7日間</span>
        </nav>
      </header>

      <section className="mt-9" aria-labelledby="trends-heading">
        <h1 id="trends-heading" className="text-[2rem] font-semibold leading-tight tracking-tight sm:text-4xl">
          この7日間の記録
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          日本時間の今日を含む7日間。保存された観測値だけを表示します。
        </p>
      </section>

      {state.kind === "unavailable" ? (
        <section className="mt-12 border-t border-border pt-6" role="status">
          <h2 className="text-lg font-medium">7日間の記録は準備中です</h2>
          <p className="mt-2 leading-7 text-muted">
            今日のストーリーは引き続き利用できます。
          </p>
        </section>
      ) : null}

      {state.kind === "error" ? (
        <section className="mt-12 border-t border-border pt-6" role="alert">
          <h2 className="text-lg font-medium">記録を読み取れませんでした</h2>
          <p className="mt-2 leading-7 text-muted">
            保存済みデータの取得に失敗しました。しばらくしてから再度ご確認ください。
          </p>
        </section>
      ) : null}

      {state.kind === "ready" ? (
        <>
          <p className="mt-7 text-sm text-muted" role="status">
            7日間のうち${state.data.observedDays}日で観測 · 計${state.data.totalObservations}件
          </p>
          <ol className="mt-9 divide-y divide-border border-t border-b border-border">
            {[...state.data.days].reverse().map((day) => (
              <li key={day.date} className="py-6">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-lg font-semibold tracking-tight">
                    {day.isToday ? "今日" : formatDay(day.date)}
                  </h2>
                  <span className="text-xs tabular-nums text-muted">
                    {day.observations > 0 ? `${day.observations}件の観測` : "データなし"}
                  </span>
                </div>
                {day.observations > 0 ? (
                  <dl className="mt-4 grid gap-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">最高CO₂</dt>
                      <dd className="font-medium tabular-nums">
                        {day.stats.co2 ? `${day.stats.co2.max.toFixed(0)} ppm` : "記録なし"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">温度</dt>
                      <dd className="font-medium tabular-nums">{formatRange(day.stats.temperature, "℃", 1)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted">湿度</dt>
                      <dd className="font-medium tabular-nums">{formatRange(day.stats.humidity, "%")}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-3 text-sm leading-7 text-muted">
                    この日の観測は保存されていません。
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-5 text-xs leading-6 text-muted">
            今日の値は途中経過です。観測のない時間帯は集計に含みません。
            数値は保存された観測の範囲であり、連続的な測定結果ではありません。
          </p>
        </>
      ) : null}
    </main>
  );
}
