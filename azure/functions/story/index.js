const { freshness } = require("../shared/history");
const { createHomeStory } = require("../shared/story");
const { getTableConfig, queryRecentEntities } = require("../shared/table-storage");
const { validateDeviceId } = require("../shared/switchbot");

function jsonResponse(status, body) {
  return {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function createStoryHandler({
  env = process.env,
  now = Date.now,
  getTableConfigFn = getTableConfig,
  queryRecentEntitiesFn = queryRecentEntities,
  createHomeStoryFn = createHomeStory,
  freshnessFn = freshness,
} = {}) {
  return async function story(context) {
    const deviceId = String(env.SWITCHBOT_DEVICE_ID ?? "").trim();
    if (!deviceId) {
      context.res = jsonResponse(503, {
        status: "not_configured",
        message: "SwitchBot device is not configured.",
      });
      return;
    }

    try {
      validateDeviceId(deviceId);
      const config = getTableConfigFn(env);
      const rows = await queryRecentEntitiesFn({
        accountName: config.accountName,
        tableName: config.historyTableName,
        sas: config.historyTableSas,
        partitionKey: deviceId,
      });
      const nowMs = now();
      const data = createHomeStoryFn(rows, nowMs);

      if (data.kind === "no_data") {
        context.res = jsonResponse(404, {
          status: "no_data",
          message: "No collected reading is available for today yet.",
        });
        return;
      }

      const staleAfterSeconds = Number(env.STALE_AFTER_SECONDS ?? 900);
      context.res = jsonResponse(200, {
        status: "ok",
        data,
        freshness: freshnessFn(data.latestObservedAt, staleAfterSeconds, nowMs),
      });
    } catch (error) {
      context.log.error(
        `Home story read failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      context.res = jsonResponse(502, {
        status: "backend_error",
        message: "Home story could not be generated from stored history.",
      });
    }
  };
}

module.exports = createStoryHandler();
module.exports.createStoryHandler = createStoryHandler;
