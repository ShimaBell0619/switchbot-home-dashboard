const assert = require("node:assert/strict");
const test = require("node:test");

const { historyHandler, latestHandler } = require("../src");

function invocationContext() {
  const log = () => {};
  log.error = () => {};
  log.warn = () => {};
  log.info = () => {};
  return { log };
}

async function withoutConfiguredDevice(run) {
  const previous = process.env.SWITCHBOT_DEVICE_ID;
  delete process.env.SWITCHBOT_DEVICE_ID;
  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete process.env.SWITCHBOT_DEVICE_ID;
    } else {
      process.env.SWITCHBOT_DEVICE_ID = previous;
    }
  }
}

test("v4 latest adapter returns the legacy HTTP response instead of mutating InvocationContext", async () => {
  const context = invocationContext();
  const response = await withoutConfiguredDevice(() =>
    latestHandler({ query: new URLSearchParams() }, context),
  );

  assert.equal(response.status, 503);
  assert.equal(context.res, undefined);
  assert.equal(JSON.parse(response.body).status, "not_configured");
});

test("v4 history adapter maps URLSearchParams to the bounded legacy query contract", async () => {
  const context = invocationContext();
  const response = await withoutConfiguredDevice(() =>
    historyHandler({ query: new URLSearchParams("window=1h") }, context),
  );

  assert.equal(response.status, 503);
  assert.equal(context.res, undefined);
  assert.equal(JSON.parse(response.body).status, "not_configured");
});
