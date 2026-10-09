const { startOfTokyoDay } = require("../shared/story");
const { createSevenDayTrend } = require("../shared/trends");
const { getTableConfig, querySevenDayEntities } = require("../shared/table-storage");
const { validateDeviceId } = require("../shared/switchbot");

const DAY = 24 * 60 * 60 * 1000;

function jsonResponse(status, body) {
  return {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

function createTrendsHandler({
  env = process.env,
  now = Date.now,
  getTableConfigFn = getTableConfig,
  querySevenDayEntitiesFn = querySevenDayEntities,
} = {}) {
  return async function trends(context) {
    const deviceId = String(env.SWITCHBOT_DEVICE_ID ?? "").trim();
    if (!deviceId) {
      context.res = jsonResponse(503, { status: "not_configured" });
      return;
    }

    try {
      validateDeviceId(deviceId);
      const config = getTableConfigFn(env);
      const nowMs = now();
      const sinceMs = startOfTokyoDay(nowMs) - 6 * DAY;
      const rows = await querySevenDayEntitiesFn({
        accountName: config.accountName,
        tableName: config.historyTableName,
        sas: config.historyTableSas,
        partitionKey: deviceId,
        sinceMs,
        nowMs,
      });
      context.res = jsonResponse(200, {
        status: "ok",
        data: createSevenDayTrend(rows, nowMs),
      });
    } catch (error) {
      context.log.error(
        `Trends aggregation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      context.res = jsonResponse(502, {
        status: "backend_error",
        message: "Stored observations could not be summarized.",
      });
    }
  };
}

module.exports = createTrendsHandler();
module.exports.createTrendsHandler = createTrendsHandler;
