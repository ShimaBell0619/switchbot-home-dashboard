const { fetchSensorStatus } = require("../shared/switchbot");
const { saveReading } = require("../shared/table-storage");

function switchBotConfig(env = process.env) {
  const names = ["SWITCHBOT_TOKEN", "SWITCHBOT_SECRET", "SWITCHBOT_DEVICE_ID"];
  const values = Object.fromEntries(names.map((name) => [name, String(env[name] ?? "").trim()]));
  const missing = names.filter((name) => !values[name]);
  if (missing.length > 0) return { configured: false, missing };
  return {
    configured: true,
    token: values.SWITCHBOT_TOKEN,
    secret: values.SWITCHBOT_SECRET,
    deviceId: values.SWITCHBOT_DEVICE_ID,
  };
}

function createCollector({
  env = process.env,
  now = () => new Date(),
  fetchSensorStatusFn = fetchSensorStatus,
  saveReadingFn = saveReading,
} = {}) {
  return async function collectSensor(context) {
    const config = switchBotConfig(env);
    if (!config.configured) {
      context.log.warn(`SwitchBot collector is not configured; missing: ${config.missing.join(", ")}`);
      return;
    }

    try {
      const status = await fetchSensorStatusFn(config);
      const observedAt = now().toISOString();
      const reading = {
        ...status,
        observedAt,
        collectedAt: observedAt,
        sourceTimestampKind: "collector",
      };

      await saveReadingFn(reading);
      context.log(`Stored SwitchBot environmental reading at ${observedAt}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.log.error(`SwitchBot collection failed: ${message}`);
      throw error;
    }
  };
}

module.exports = createCollector();
module.exports.createCollector = createCollector;
module.exports.switchBotConfig = switchBotConfig;
