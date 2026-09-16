const { freshness } = require("../shared/history");
const { getEntity, getTableConfig } = require("../shared/table-storage");
const { validateDeviceId } = require("../shared/switchbot");

function jsonResponse(status, body) {
  return {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function createLatestHandler({
  env = process.env,
  getEntityFn = getEntity,
  getTableConfigFn = getTableConfig,
  freshnessFn = freshness,
} = {}) {
  return async function latest(context) {
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
      const entity = await getEntityFn({
        accountName: config.accountName,
        tableName: config.currentTableName,
        sas: config.currentTableSas,
        partitionKey: deviceId,
        rowKey: "current",
      });

      if (!entity) {
        context.res = jsonResponse(404, {
          status: "no_data",
          message: "No collected reading is available yet.",
        });
        return;
      }

      const staleAfterSeconds = Number(env.STALE_AFTER_SECONDS ?? 900);
      context.res = jsonResponse(200, {
        status: "ok",
        data: entity,
        freshness: freshnessFn(entity.observedAt, staleAfterSeconds),
      });
    } catch (error) {
      context.log.error(
        `Latest reading failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      context.res = jsonResponse(502, {
        status: "backend_error",
        message: "Stored reading could not be loaded.",
      });
    }
  };
}

module.exports = createLatestHandler();
module.exports.createLatestHandler = createLatestHandler;
