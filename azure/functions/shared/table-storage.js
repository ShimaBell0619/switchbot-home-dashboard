const TABLE_API_VERSION = "2019-02-02";
const MAX_HISTORY_ROWS = 288;
const MAX_INVERTED_TIMESTAMP = 9_999_999_999_999;

function requireSetting(name, env = process.env) {
  const value = String(env[name] ?? "").trim();
  if (!value) throw new Error(`Required app setting is missing: ${name}`);
  return value;
}

function getTableConfig(env = process.env) {
  return {
    accountName: requireSetting("STORAGE_ACCOUNT_NAME", env),
    currentTableName: requireSetting("CURRENT_TABLE_NAME", env),
    currentTableSas: requireSetting("CURRENT_TABLE_SAS", env),
    historyTableName: requireSetting("HISTORY_TABLE_NAME", env),
    historyTableSas: requireSetting("HISTORY_TABLE_SAS", env),
  };
}

function normalizeSas(sas) {
  return String(sas).trim().replace(/^\?/, "");
}

function escapeODataKey(value) {
  return String(value).replaceAll("'", "''");
}

function buildTableUrl({ accountName, tableName, sas, entity, query }) {
  const entitySuffix = entity
    ? `(PartitionKey='${escapeODataKey(entity.partitionKey)}',RowKey='${escapeODataKey(entity.rowKey)}')`
    : "()";
  const url = new URL(`https://${accountName}.table.core.windows.net/${tableName}${entitySuffix}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }

  const sasParams = new URLSearchParams(normalizeSas(sas));
  for (const [key, value] of sasParams.entries()) url.searchParams.set(key, value);
  return url;
}

function tableHeaders(extra = {}) {
  return {
    Accept: "application/json;odata=nometadata",
    "Content-Type": "application/json",
    "x-ms-date": new Date().toUTCString(),
    "x-ms-version": TABLE_API_VERSION,
    ...extra,
  };
}

async function readError(response) {
  const text = await response.text().catch(() => "");
  return text.slice(0, 500);
}

async function upsertEntity({ accountName, tableName, sas, entity, fetchImpl = fetch }) {
  const url = buildTableUrl({
    accountName,
    tableName,
    sas,
    entity: { partitionKey: entity.PartitionKey, rowKey: entity.RowKey },
  });
  const response = await fetchImpl(url, {
    method: "PUT",
    headers: tableHeaders(),
    body: JSON.stringify(entity),
  });
  if (!response.ok) {
    throw new Error(`Table upsert failed (HTTP ${response.status}): ${await readError(response)}`);
  }
}

async function getEntity({ accountName, tableName, sas, partitionKey, rowKey, fetchImpl = fetch }) {
  const url = buildTableUrl({
    accountName,
    tableName,
    sas,
    entity: { partitionKey, rowKey },
  });
  const response = await fetchImpl(url, { method: "GET", headers: tableHeaders() });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Table point read failed (HTTP ${response.status}): ${await readError(response)}`);
  }
  return response.json();
}

async function queryRecentEntities({
  accountName,
  tableName,
  sas,
  partitionKey,
  fetchImpl = fetch,
  top = MAX_HISTORY_ROWS,
}) {
  const boundedTop = Math.min(Math.max(Number(top) || 1, 1), MAX_HISTORY_ROWS);
  const filter = `PartitionKey eq '${escapeODataKey(partitionKey)}'`;
  const url = buildTableUrl({
    accountName,
    tableName,
    sas,
    query: { $filter: filter, $top: boundedTop },
  });
  const response = await fetchImpl(url, { method: "GET", headers: tableHeaders() });
  if (!response.ok) {
    throw new Error(`Table history query failed (HTTP ${response.status}): ${await readError(response)}`);
  }
  const payload = await response.json();
  return Array.isArray(payload?.value) ? payload.value : [];
}

function historyRowKey(observedAt) {
  const timestamp = new Date(observedAt).getTime();
  if (!Number.isFinite(timestamp)) throw new Error("Invalid observation timestamp");
  const bucketStart = Math.floor(timestamp / 300_000) * 300_000;
  return String(MAX_INVERTED_TIMESTAMP - bucketStart).padStart(13, "0");
}

function readingEntity(reading, rowKey) {
  return {
    PartitionKey: reading.deviceId,
    RowKey: rowKey,
    deviceId: reading.deviceId,
    deviceType: reading.deviceType,
    temperature: reading.temperature,
    humidity: reading.humidity,
    ...(reading.battery === undefined ? {} : { battery: reading.battery }),
    observedAt: reading.observedAt,
    collectedAt: reading.collectedAt,
    sourceTimestampKind: reading.sourceTimestampKind,
  };
}

async function saveReading(reading, options = {}) {
  const config = options.config ?? getTableConfig();
  const fetchImpl = options.fetchImpl ?? fetch;
  const currentEntity = readingEntity(reading, "current");
  const historyEntity = readingEntity(reading, historyRowKey(reading.observedAt));

  await upsertEntity({
    accountName: config.accountName,
    tableName: config.historyTableName,
    sas: config.historyTableSas,
    entity: historyEntity,
    fetchImpl,
  });
  await upsertEntity({
    accountName: config.accountName,
    tableName: config.currentTableName,
    sas: config.currentTableSas,
    entity: currentEntity,
    fetchImpl,
  });
}

module.exports = {
  MAX_HISTORY_ROWS,
  buildTableUrl,
  getEntity,
  getTableConfig,
  historyRowKey,
  queryRecentEntities,
  saveReading,
  upsertEntity,
};
