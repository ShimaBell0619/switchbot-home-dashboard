const http = require("node:http");
const history = require("./history");
const latest = require("./latest");
const story = require("./story");

function writeResponse(res, result) {
  res.statusCode = result?.status ?? 500;
  for (const [name, value] of Object.entries(result?.headers ?? {})) {
    res.setHeader(name, value);
  }
  res.end(result?.body ?? "");
}

function createRequestHandler({
  historyHandler = history,
  latestHandler = latest,
  storyHandler = story,
  logger = console,
} = {}) {
  return async function requestHandler(req, res) {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/healthz") {
      writeResponse(res, {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ status: "ok" }),
      });
      return;
    }

    if (req.method !== "GET") {
      writeResponse(res, {
        status: 405,
        headers: {
          Allow: "GET",
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ status: "method_not_allowed" }),
      });
      return;
    }

    const routes = {
      "/api/latest": latestHandler,
      "/api/history": historyHandler,
      "/api/story": storyHandler,
    };
    const handler = routes[url.pathname];
    if (!handler) {
      writeResponse(res, {
        status: 404,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ status: "not_found" }),
      });
      return;
    }

    const context = {
      log: {
        error: (...args) => logger.error(...args),
        warn: (...args) => logger.warn(...args),
      },
      res: undefined,
    };

    try {
      await handler(context, {
        query: { window: url.searchParams.get("window") ?? undefined },
      });
      writeResponse(res, context.res);
    } catch (error) {
      logger.error(
        `Unhandled API request failure: ${error instanceof Error ? error.message : String(error)}`,
      );
      writeResponse(res, {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ status: "internal_error" }),
      });
    }
  };
}

function startServer({ port = Number(process.env.PORT ?? 3000), logger = console } = {}) {
  const server = http.createServer(createRequestHandler({ logger }));
  server.listen(port, "0.0.0.0", () => {
    logger.log(`SwitchBot backend listening on port ${port}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { createRequestHandler, startServer, writeResponse };
