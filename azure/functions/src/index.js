const { app } = require("@azure/functions");
const collector = require("../collectSensor");
const history = require("../history");
const latest = require("../latest");

app.timer("collectSensor", {
  schedule: "0 */5 * * * *",
  runOnStartup: false,
  useMonitor: true,
  handler: async (_timer, context) => collector(context),
});

app.http("latest", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "latest",
  handler: async (request, context) => {
    await latest(context, request);
    return context.res;
  },
});

app.http("history", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "history",
  handler: async (request, context) => {
    await history(context, {
      query: { window: request.query.get("window") ?? undefined },
    });
    return context.res;
  },
});
