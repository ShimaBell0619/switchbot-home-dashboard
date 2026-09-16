import assert from "node:assert/strict";
import test from "node:test";

import directTable from "../lib/direct-table.js";

const { getDirectTableConfig, readDirectDashboardState } = directTable;
const now = Date.parse("2026-09-15T12:00:00.000Z");

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("direct Table configuration is absent until every server-side setting exists", () => {
  assert.equal(getDirectTableConfig({}), null);
  assert.throws(
    () => getDirectTableConfig({ AZURE_STORAGE_ACCOUNT_NAME: "storageexample" }),
    /partially configured/,
  );
});

test("direct Table read returns Home Story without calling the legacy API", async () => {
  const calls = [];
  const state = await readDirectDashboardState({
    env: {
      AZURE_STORAGE_ACCOUNT_NAME: "storageexample",
      AZURE_HISTORY_TABLE_NAME: "SensorReadings",
      AZURE_HISTORY_TABLE_SAS: "sv=test&sp=r",
      SWITCHBOT_DEVICE_ID: "device-1",
    },
    now: () => now,
    fetchImpl: async (input) => {
      calls.push(String(input));
      return jsonResponse({
        value: [
          {
            observedAt: "2026-09-15T01:00:00.000Z",
            co2: 600,
            temperature: 27.5,
            humidity: 55,
          },
          {
            observedAt: "2026-09-15T02:00:00.000Z",
            co2: 620,
            temperature: 27.6,
            humidity: 56,
          },
        ],
      });
    },
  });

  assert.equal(state.kind, "ready");
  assert.equal(calls.length, 1);
  assert.match(
    calls[0],
    /^https:\/\/storageexample\.table\.core\.windows\.net\/SensorReadings\(\)/,
  );
  assert.match(calls[0], /%24filter=PartitionKey\+eq/);
  assert.match(calls[0], /%24top=288/);
});
