const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const transactionRoutes = require("./routes/transactionRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { clientApiKeyAuth, adminApiKeyAuth } = require("./middleware/apiKeyAuth");
const { createRateLimiter } = require("./middleware/rateLimiter");
const { checkDatabase } = require("./db/postgres");
const { getTransactionMetrics } = require("./store/transactionStore");
const { getEventMetrics } = require("./store/outboxStore");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
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
  const ready = !database.configured || database.connected;

  res.status(ready ? 200 : 503).json({
    status: ready ? "READY" : "NOT_READY",
    database
  });
});

app.get("/metrics", async (req, res) => {
  const transactionMetrics = await getTransactionMetrics();
  const eventRows = await getEventMetrics();

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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`HSMP running on port ${PORT}`);
  });
}

module.exports = { app };
