export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16 sm:px-10">
      <p className="mb-3 text-sm font-medium text-muted">Architecture PoC</p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        SwitchBot Home Dashboard
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
        SwitchBot のセンサーデータをバックグラウンドで収集し、自前ストレージから高速に参照する構成を検証します。
      </p>
      <section className="mt-10 border-t border-border pt-6" aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-sm font-semibold text-foreground">
          Bootstrap status
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted">Foundation</dt>
          <dd>v0.10.0 adopted</dd>
          <dt className="text-muted">Data path</dt>
          <dd>Not connected yet</dd>
          <dt className="text-muted">Next step</dt>
          <dd>SwitchBot → Azure Functions → Table Storage → Web</dd>
        </dl>
      </section>
    </main>
  );
}
