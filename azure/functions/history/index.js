const { filterHistoryWindow, parseHistoryWindow } = require("../shared/history");
const { getTableConfig, queryRecentEntities } = require("../shared/table-storage");
const { validateDeviceId } = require("../shared/switchbot");

function jsonResponse(status, body) {
  return {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function createHistoryHandler({
  env = process.env,
  now = Date.now,
  getTableConfigFn = getTableConfig,
  queryRecentEntitiesFn = queryRecentEntities,
} = {}) {
  return async function history(context, req) {
    const deviceId = String(env.SWITCHBOT_DEVICE_ID ?? "").trim();
    if (!deviceId) {
      context.res = jsonResponse(503, {
        status: "not_configured",
        message: "SwitchBot device is not configured.",
      });
      return;
    }

    let window;
    try {
      window = parseHistoryWindow(req.query?.window);
    } catch (error) {
      context.res = jsonResponse(400, {
        status: "invalid_request",
        message: error instanceof Error ? error.message : "Invalid history window.",
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
      const filtered = filterHistoryWindow(rows, window, now());

      context.res = jsonResponse(200, {
        status: "ok",
        window: window.name,
        count: filtered.length,
        data: filtered,
      });
    } catch (error) {
      context.log.error(
        `History read failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      context.res = jsonResponse(502, {
        status: "backend_error",
        message: "Stored history could not be loaded.",
      });
    }
  };
}

module.exports = createHistoryHandler();
module.exports.createHistoryHandler = createHistoryHandler;
