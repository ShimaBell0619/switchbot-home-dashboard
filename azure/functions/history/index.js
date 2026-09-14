const { filterHistoryWindow, parseHistoryWindow } = require("../shared/history");
const { getTableConfig, queryRecentEntities } = require("../shared/table-storage");
const { validateDeviceId } = require("../shared/switchbot");

module.exports = async function history(context, req) {
  const deviceId = String(process.env.SWITCHBOT_DEVICE_ID ?? "").trim();
  if (!deviceId) {
    context.res = {
      status: 503,
      jsonBody: { status: "not_configured", message: "SwitchBot device is not configured." },
    };
    return;
  }

  let window;
  try {
    window = parseHistoryWindow(req.query?.window);
  } catch (error) {
    context.res = {
      status: 400,
      jsonBody: { status: "invalid_request", message: error.message },
    };
    return;
  }

  try {
    validateDeviceId(deviceId);
    const config = getTableConfig();
    const rows = await queryRecentEntities({
      accountName: config.accountName,
      tableName: config.historyTableName,
      sas: config.historyTableSas,
      partitionKey: deviceId,
    });
    const filtered = filterHistoryWindow(rows, window);

    context.res = {
      status: 200,
      jsonBody: {
        status: "ok",
        window: window.name,
        count: filtered.length,
        data: filtered,
      },
    };
  } catch (error) {
    context.log.error(`History read failed: ${error instanceof Error ? error.message : String(error)}`);
    context.res = {
      status: 502,
      jsonBody: { status: "backend_error", message: "Stored history could not be loaded." },
    };
  }
};
