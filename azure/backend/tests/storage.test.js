const assert = require("node:assert/strict");
const test = require("node:test");

const {
  historyRowKey,
  queryRecentEntities,
  querySevenDayEntities,
  saveReading,
} = require("../shared/table-storage");

const config = {
  accountName: "example",
  currentTableName: "CurrentState",
  currentTableSas: "sp=rau&sig=current",
  historyTableName: "SensorReadings",
  historyTableSas: "sp=rau&sig=history",
};

test("uses one stable row key for retries inside the same five-minute bucket", () => {
  assert.equal(
    historyRowKey("2026-09-14T12:01:00.000Z"),
    historyRowKey("2026-09-14T12:04:59.999Z"),
  );
  assert.notEqual(
    historyRowKey("2026-09-14T12:04:59.999Z"),
    historyRowKey("2026-09-14T12:05:00.000Z"),
  );
});

test("retries upsert the same history entity instead of creating a second identity", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: String(url), options });
    return { ok: true, status: 204, text: async () => "" };
  };
  const base = {
    deviceId: "ABC123",
    deviceType: "MeterPro(CO2)",
    temperature: 24.6,
    humidity: 51,
    battery: 100,
    co2: 742,
    collectedAt: "2026-09-14T12:01:00.000Z",
    sourceTimestampKind: "collector",
  };

  await saveReading({ ...base, observedAt: "2026-09-14T12:01:00.000Z" }, { config, fetchImpl });
  await saveReading({ ...base, observedAt: "2026-09-14T12:04:00.000Z" }, { config, fetchImpl });

  assert.equal(requests.length, 4);
  const historyRequests = requests.filter((request) => request.url.includes("SensorReadings"));
  assert.equal(historyRequests.length, 2);
  assert.equal(historyRequests[0].url, historyRequests[1].url);
  assert.equal(JSON.parse(historyRequests[0].options.body).co2, 742);
  assert.ok(requests.every((request) => request.options.method === "PUT"));
});

test("history storage query is capped at 288 rows regardless of a larger request", async () => {
  let requestedUrl = "";
  const rows = await queryRecentEntities({
    accountName: config.accountName,
    tableName: config.historyTableName,
    sas: config.historyTableSas,
    partitionKey: "ABC123",
    top: 5000,
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return { ok: true, status: 200, json: async () => ({ value: [] }) };
    },
  });

  assert.deepEqual(rows, []);
  const url = new URL(requestedUrl);
  assert.equal(url.searchParams.get("$top"), "288");
  assert.equal(url.searchParams.get("$filter"), "PartitionKey eq 'ABC123'");
});

test("seven-day query paginates and bounds history with the inverted RowKey", async () => {
  const requests = [];
  const sinceMs = Date.parse("2026-10-03T15:00:00.000Z");
  const nowMs = Date.parse("2026-10-10T03:00:00.000Z");
  const fetchImpl = async (url) => {
    requests.push(new URL(String(url)));
    if (requests.length === 1) {
      return new Response(JSON.stringify({
        value: [{ observedAt: "2026-10-04T00:00:00.000Z", co2: 600 }],
      }), {
        status: 200,
        headers: {
          "x-ms-continuation-nextpartitionkey": "ABC123",
          "x-ms-continuation-nextrowkey": "next-row",
        },
      });
    }
    return new Response(JSON.stringify({
      value: [
        { observedAt: "2026-10-10T01:00:00.000Z", co2: 700 },
        { observedAt: "2026-10-03T14:59:59.000Z", co2: 900 },
      ],
    }));
  };
  const rows = await querySevenDayEntities({
    accountName: config.accountName,
    tableName: config.historyTableName,
    sas: config.historyTableSas,
    partitionKey: "ABC123",
    sinceMs,
    nowMs,
    fetchImpl,
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get("$top"), "1000");
  assert.match(requests[0].searchParams.get("$filter"), /PartitionKey eq 'ABC123' and RowKey le '\d{13}'/);
  assert.equal(requests[1].searchParams.get("NextPartitionKey"), "ABC123");
  assert.equal(requests[1].searchParams.get("NextRowKey"), "next-row");
  assert.deepEqual(rows.map((row) => row.co2), [600, 700]);
});

test("seven-day query does not return a truncated aggregate when too many readings exist", async () => {
  await assert.rejects(
    querySevenDayEntities({
      accountName: config.accountName,
      tableName: config.historyTableName,
      sas: config.historyTableSas,
      partitionKey: "ABC123",
      sinceMs: Date.parse("2026-10-03T15:00:00.000Z"),
      nowMs: Date.parse("2026-10-10T03:00:00.000Z"),
      fetchImpl: async () => new Response(JSON.stringify({ value: Array.from({ length: 2301 }, () => ({ observedAt: "2026-10-10T00:00:00Z" })) })),
    }),
    /bounded observation limit/,
  );
});

test("seven-day query rejects repeated continuation tokens", async () => {
  await assert.rejects(
    querySevenDayEntities({
      accountName: config.accountName,
      tableName: config.historyTableName,
      sas: config.historyTableSas,
      partitionKey: "ABC123",
      sinceMs: Date.parse("2026-10-03T15:00:00.000Z"),
      nowMs: Date.parse("2026-10-10T03:00:00.000Z"),
      fetchImpl: async () => new Response(JSON.stringify({ value: [] }), {
        headers: {
          "x-ms-continuation-nextpartitionkey": "ABC123",
          "x-ms-continuation-nextrowkey": "same",
        },
      }),
    }),
    /continuation token repeated/,
  );
});
