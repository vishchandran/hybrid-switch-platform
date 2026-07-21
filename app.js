const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const transactionRoutes = require("./routes/transactionRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { clientApiKeyAuth, adminApiKeyAuth } = require("./middleware/apiKeyAuth");
const { createRateLimiter } = require("./middleware/rateLimiter");
const { checkDatabase, closeDatabase } = require("./db/postgres");
const {
  buildCorsOptions,
  validateProductionConfig
} = require("./config/runtimeConfig");
const { getTransactionMetrics } = require("./store/transactionStore");
const { getEventMetrics } = require("./store/outboxStore");
const { getDeadLetterMetrics } = require("./store/deadLetterStore");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: "10kb" }));

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    service: "Hybrid Switch Modernization Platform",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

app.get("/ready", async (req, res) => {
  const database = await checkDatabase();
  const ready =
    process.env.NODE_ENV === "production"
      ? database.configured && database.connected
      : !database.configured || database.connected;

  res.status(ready ? 200 : 503).json({
    status: ready ? "READY" : "NOT_READY",
    database
  });
});

app.get("/metrics", adminApiKeyAuth, async (req, res) => {
  const transactionMetrics = await getTransactionMetrics();
  const eventRows = await getEventMetrics();
  const deadLetterMetrics = await getDeadLetterMetrics();

  const eventCounts = eventRows.reduce((counts, row) => {
    const eventType = row.event_type;
    const status = row.status;
    counts[eventType] = counts[eventType] || {};
    counts[eventType][status] = (counts[eventType][status] || 0) + Number(row.count);
    return counts;
  }, {});

  res.status(200).json({
    totalTransactions: Number(transactionMetrics.total_transactions || 0),
    approved: Number(transactionMetrics.approved || 0),
    declined: Number(transactionMetrics.declined || 0),
    failed: Number(transactionMetrics.failed || 0),
    standInCount: Number(transactionMetrics.stand_in_count || 0),
    reversalCount:
      eventCounts.REVERSAL_EVENT && eventCounts.REVERSAL_EVENT.PROCESSED
        ? eventCounts.REVERSAL_EVENT.PROCESSED
        : 0,
    failedEventCount: Object.values(eventCounts).reduce(
      (total, statuses) => total + Number(statuses.FAILED || 0),
      0
    ),
    deadLetterCount: Number(deadLetterMetrics.total || 0),
    eventCounts
  });
});

app.use(
  "/transactions",
  createRateLimiter({ windowMs: 60_000, maxRequests: 60 }),
  clientApiKeyAuth,
  transactionRoutes
);
app.use(
  "/admin",
  createRateLimiter({ windowMs: 60_000, maxRequests: 20 }),
  adminApiKeyAuth,
  adminRoutes
);

app.use((error, req, res, next) => {
  if (error && error.type === "entity.too.large") {
    return res.status(413).json({
      status: "PAYLOAD_TOO_LARGE",
      reason: "Request body exceeds the 10 KB limit"
    });
  }

  if (error && error.message === "CORS origin not allowed") {
    return res.status(403).json({
      status: "FORBIDDEN",
      reason: "CORS origin not allowed"
    });
  }

  console.error("UNHANDLED_REQUEST_ERROR:", error.message);
  return res.status(500).json({
    status: "ERROR",
    reason: "Internal server error"
  });
});

function startServer() {
  validateProductionConfig();

  const server = app.listen(PORT, () => {
    console.log(`HSMP running on port ${PORT}`);
  });

  async function shutdown(signal) {
    console.log(`HSMP shutdown started: ${signal}`);
    server.close(async error => {
      if (error) {
        console.error("HSMP server close failed:", error.message);
        process.exit(1);
      }

      try {
        await closeDatabase();
        console.log("HSMP shutdown complete");
        process.exit(0);
      } catch (closeError) {
        console.error("HSMP database close failed:", closeError.message);
        process.exit(1);
      }
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
