const { createCollector, switchBotConfig } = require("./collectSensor");

function createLoggerContext(logger = console) {
  const log = (...args) => logger.log(...args);
  log.warn = (...args) => logger.warn(...args);
  log.error = (...args) => logger.error(...args);
  return { log };
}

async function runCollector({ env = process.env, logger = console, createCollectorFn = createCollector } = {}) {
  const config = switchBotConfig(env);
  if (!config.configured) {
    throw new Error(`SwitchBot collector is not configured; missing: ${config.missing.join(", ")}`);
  }

  const collector = createCollectorFn({ env });
  await collector(createLoggerContext(logger));
}

if (require.main === module) {
  runCollector().catch((error) => {
    console.error(
      `SwitchBot collection job failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}

module.exports = { createLoggerContext, runCollector };
