const { freshness } = require("../shared/history");
const { getEntity, getTableConfig } = require("../shared/table-storage");
const { validateDeviceId } = require("../shared/switchbot");

module.exports = async function latest(context) {
  const deviceId = String(process.env.SWITCHBOT_DEVICE_ID ?? "").trim();
  if (!deviceId) {
    context.res = {
      status: 503,
      jsonBody: { status: "not_configured", message: "SwitchBot device is not configured." },
    };
    return;
  }

  try {
    validateDeviceId(deviceId);
    const config = getTableConfig();
    const entity = await getEntity({
      accountName: config.accountName,
      tableName: config.currentTableName,
      sas: config.currentTableSas,
      partitionKey: deviceId,
      rowKey: "current",
    });

    if (!entity) {
      context.res = {
        status: 404,
        jsonBody: { status: "no_data", message: "No collected reading is available yet." },
      };
      return;
    }

    const staleAfterSeconds = Number(process.env.STALE_AFTER_SECONDS ?? 900);
    context.res = {
      status: 200,
      jsonBody: {
        status: "ok",
        data: entity,
        freshness: freshness(entity.observedAt, staleAfterSeconds),
      },
    };
  } catch (error) {
    context.log.error(`Latest reading failed: ${error instanceof Error ? error.message : String(error)}`);
    context.res = {
      status: 502,
      jsonBody: { status: "backend_error", message: "Stored reading could not be loaded." },
    };
  }
};
