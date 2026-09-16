const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createRequestHandler } = require("../server");
const { runCollector } = require("../collect");

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("HTTP runtime preserves API routing and history query", async () => {
  let historyWindow;
  const response = (body) => async (context) => {
    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    };
  };
  const handler = createRequestHandler({
    latestHandler: response({ route: "latest" }),
    storyHandler: response({ route: "story" }),
    historyHandler: async (context, req) => {
      historyWindow = req.query.window;
      context.res = {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ route: "history" }),
      };
    },
    logger: { log() {}, warn() {}, error() {} },
  });

  await withServer(handler, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/healthz`);
    assert.equal(health.status, 200);

    const history = await fetch(`${baseUrl}/api/history?window=6h`);
    assert.equal(history.status, 200);
    assert.equal(historyWindow, "6h");

    const missing = await fetch(`${baseUrl}/missing`);
    assert.equal(missing.status, 404);

    const rejected = await fetch(`${baseUrl}/api/story`, { method: "POST" });
    assert.equal(rejected.status, 405);
    assert.equal(rejected.headers.get("allow"), "GET");
  });
});

test("collector runtime fails fast when SwitchBot settings are missing", async () => {
  await assert.rejects(
    runCollector({
      env: {},
      logger: { log() {}, warn() {}, error() {} },
      createCollectorFn: () => async () => assert.fail("collector must not run"),
    }),
    /not configured/,
  );
});

test("collector runtime invokes the collector once when configured", async () => {
  let calls = 0;
  await runCollector({
    env: {
      SWITCHBOT_TOKEN: "token",
      SWITCHBOT_SECRET: "secret",
      SWITCHBOT_DEVICE_ID: "ABC123",
    },
    logger: { log() {}, warn() {}, error() {} },
    createCollectorFn: () => async () => {
      calls += 1;
    },
  });
  assert.equal(calls, 1);
});
