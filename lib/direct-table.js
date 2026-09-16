const { freshness } = require("../azure/backend/shared/history");
const { createHomeStory } = require("../azure/backend/shared/story");
const { queryRecentEntities } = require("../azure/backend/shared/table-storage");

function readSetting(env, name) {
  return String(env[name] ?? "").trim();
}

function getDirectTableConfig(env = process.env) {
  const accountName = readSetting(env, "AZURE_STORAGE_ACCOUNT_NAME");
  const historyTableName = readSetting(env, "AZURE_HISTORY_TABLE_NAME");
  const historyTableSas = readSetting(env, "AZURE_HISTORY_TABLE_SAS");
  const deviceId = readSetting(env, "SWITCHBOT_DEVICE_ID");

  const values = [accountName, historyTableName, historyTableSas, deviceId];
  if (values.every((value) => !value)) return null;
  if (values.some((value) => !value)) {
    throw new Error("Azure Table read settings are only partially configured.");
  }

  return { accountName, historyTableName, historyTableSas, deviceId };
}

async function readDirectDashboardState({
  env = process.env,
  fetchImpl = fetch,
  now = Date.now,
} = {}) {
  const config = getDirectTableConfig(env);
  if (!config) return null;

  const rows = await queryRecentEntities({
    accountName: config.accountName,
    tableName: config.historyTableName,
    sas: config.historyTableSas,
    partitionKey: config.deviceId,
    fetchImpl,
  });
  const nowMs = now();
  const story = createHomeStory(rows, nowMs);

  if (story.kind === "no_data") return { kind: "no_data" };

  const staleAfterSeconds = Number(env.STALE_AFTER_SECONDS ?? 900);
  return {
    kind: "ready",
    story,
    freshness: freshness(story.latestObservedAt, staleAfterSeconds, nowMs),
  };
}

module.exports = { getDirectTableConfig, readDirectDashboardState };
