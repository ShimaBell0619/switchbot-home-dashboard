const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createSignature,
  fetchSensorStatus,
  validateStatusBody,
} = require("../shared/switchbot");

test("creates the documented HMAC-SHA256 base64 signature", () => {
  assert.equal(
    createSignature("token", "secret", 1661927531000, "request-id"),
    "o3WpwXG3dO4bK931J6W/iSTdQB/SLl+eCkerZOEX6jY=",
  );
});

test("accepts a successful environmental sensor response", async () => {
  const calls = [];
  const result = await fetchSensorStatus({
    token: "token",
    secret: "secret",
    deviceId: "ABC123",
    now: () => 1661927531000,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          statusCode: 100,
          message: "success",
          body: {
            deviceId: "ABC123",
            deviceType: "MeterPlus",
            temperature: 24.6,
            humidity: 51,
            battery: 100,
          },
        }),
      };
    },
  });

  assert.equal(result.temperature, 24.6);
  assert.equal(result.humidity, 51);
  assert.equal(result.battery, 100);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers.Authorization, "token");
  assert.equal(calls[0].options.headers.t, "1661927531000");
  assert.ok(calls[0].options.headers.sign);
  assert.ok(calls[0].options.headers.nonce);
});

test("normalizes Meter Pro CO2 from the documented uppercase CO2 field", () => {
  const reading = validateStatusBody({
    deviceId: "ABC123",
    deviceType: "MeterPro(CO2)",
    temperature: 24.5,
    humidity: 50,
    battery: 98,
    CO2: 742,
  });

  assert.equal(reading.co2, 742);
  assert.equal(reading.temperature, 24.5);
  assert.equal(reading.humidity, 50);
});

test("rejects a Meter Pro CO2 response without a valid CO2 reading", () => {
  assert.throws(
    () =>
      validateStatusBody({
        deviceType: "MeterPro(CO2)",
        temperature: 24.5,
        humidity: 50,
      }),
    /CO2 value/,
  );
  assert.throws(
    () =>
      validateStatusBody({
        deviceType: "MeterPro(CO2)",
        temperature: 24.5,
        humidity: 50,
        CO2: 10_000,
      }),
    /invalid CO2/,
  );
});

test("rejects SwitchBot application-level failures even when HTTP succeeds", async () => {
  await assert.rejects(
    fetchSensorStatus({
      token: "token",
      secret: "secret",
      deviceId: "ABC123",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ statusCode: 190, message: "System error" }),
      }),
    }),
    /statusCode 190/,
  );
});

test("rejects malformed environmental readings", () => {
  assert.throws(() => validateStatusBody({ temperature: 24.5, humidity: 101 }), /humidity/);
  assert.throws(() => validateStatusBody({ temperature: "24.5", humidity: 50 }), /temperature/);
});
