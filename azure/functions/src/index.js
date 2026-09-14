const { app } = require("@azure/functions");
const collector = require("../collectSensor");
const history = require("../history");
const latest = require("../latest");

function legacyContext(context) {
  return {
    log: context.log,
    res: undefined,
  };
}

async function collectSensorHandler(_timer, context) {
  return collector(context);
}

async function latestHandler(request, context) {
  const handlerContext = legacyContext(context);
  await latest(handlerContext, request);
  return handlerContext.res;
}

async function historyHandler(request, context) {
  const handlerContext = legacyContext(context);
  await history(handlerContext, {
    query: { window: request.query.get("window") ?? undefined },
  });
  return handlerContext.res;
}

app.timer("collectSensor", {
  schedule: "0 */5 * * * *",
  runOnStartup: false,
  useMonitor: true,
  handler: collectSensorHandler,
});

app.http("latest", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "latest",
  handler: latestHandler,
});

app.http("history", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "history",
  handler: historyHandler,
});

module.exports = {
  collectSensorHandler,
  historyHandler,
  latestHandler,
};
