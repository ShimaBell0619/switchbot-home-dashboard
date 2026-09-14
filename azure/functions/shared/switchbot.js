const crypto = require("node:crypto");

const SWITCHBOT_API_BASE_URL = "https://api.switch-bot.com";

function createSignature(token, secret, timestamp, nonce) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${token}${timestamp}${nonce}`, "utf8")
    .digest("base64");
}

function createHeaders({ token, secret, timestamp = Date.now(), nonce = crypto.randomUUID() }) {
  if (!token || !secret) {
    throw new Error("SwitchBot token and secret are required");
  }

  return {
    Authorization: token,
    sign: createSignature(token, secret, timestamp, nonce),
    t: String(timestamp),
    nonce,
    "Content-Type": "application/json",
  };
}

function validateDeviceId(deviceId) {
  if (!deviceId || !/^[A-Za-z0-9:_-]{1,128}$/.test(deviceId)) {
    throw new Error("SwitchBot device ID is missing or invalid");
  }
  return deviceId;
}

function validateStatusBody(body) {
  if (!body || typeof body !== "object") {
    throw new Error("SwitchBot response body is missing");
  }
  if (!Number.isFinite(body.temperature)) {
    throw new Error("SwitchBot response does not contain a valid temperature");
  }
  if (!Number.isInteger(body.humidity) || body.humidity < 0 || body.humidity > 100) {
    throw new Error("SwitchBot response does not contain a valid humidity");
  }
  if (
    body.battery !== undefined &&
    (!Number.isInteger(body.battery) || body.battery < 0 || body.battery > 100)
  ) {
    throw new Error("SwitchBot response contains an invalid battery value");
  }

  return {
    deviceId: String(body.deviceId ?? ""),
    deviceType: String(body.deviceType ?? "Unknown"),
    temperature: body.temperature,
    humidity: body.humidity,
    ...(body.battery === undefined ? {} : { battery: body.battery }),
  };
}

async function fetchSensorStatus({ token, secret, deviceId, fetchImpl = fetch, now = Date.now }) {
  const normalizedDeviceId = validateDeviceId(deviceId);
  const timestamp = now();
  const nonce = crypto.randomUUID();
  const response = await fetchImpl(
    `${SWITCHBOT_API_BASE_URL}/v1.1/devices/${encodeURIComponent(normalizedDeviceId)}/status`,
    {
      method: "GET",
      headers: createHeaders({ token, secret, timestamp, nonce }),
    },
  );

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`SwitchBot returned non-JSON response (HTTP ${response.status})`);
  }

  if (!response.ok) {
    throw new Error(`SwitchBot request failed (HTTP ${response.status})`);
  }
  if (payload?.statusCode !== 100) {
    throw new Error(`SwitchBot request failed (statusCode ${String(payload?.statusCode ?? "unknown")})`);
  }

  const status = validateStatusBody(payload.body);
  if (status.deviceId && status.deviceId !== normalizedDeviceId) {
    throw new Error("SwitchBot response device ID does not match the configured device");
  }
  status.deviceId = normalizedDeviceId;
  return status;
}

module.exports = {
  createHeaders,
  createSignature,
  fetchSensorStatus,
  validateDeviceId,
  validateStatusBody,
};
