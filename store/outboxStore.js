const crypto = require("crypto");
const { isDatabaseConfigured, query } = require("../db/postgres");
const { sanitizeText } = require("../utils/sensitiveData");

const outboxEvents = [];

async function saveOutboxEvent(event) {
  const storedEvent = {
    eventId: `EVT-${crypto.randomUUID()}`,
    transactionId: event.payload && event.payload.transactionId,
    eventType: event.eventType,
    topic: event.topic,
    payload: event.payload,
    status: "PENDING",
    retryCount: 0,
    createdAt: new Date().toISOString(),
    processedAt: null,
    failedAt: null,
    lastError: null
  };

  if (isDatabaseConfigured()) {
    await query(
      `INSERT INTO outbox_events
        (event_id, transaction_id, event_type, topic, payload, status, retry_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        storedEvent.eventId,
        storedEvent.transactionId,
        storedEvent.eventType,
        storedEvent.topic,
        storedEvent.payload,
        storedEvent.status,
        storedEvent.retryCount
      ]
    );
  } else {
    outboxEvents.push(storedEvent);
  }

  return storedEvent;
}

async function markOutboxProcessed(eventId) {
  if (isDatabaseConfigured()) {
    await query(
      `UPDATE outbox_events
       SET status = 'PROCESSED', processed_at = NOW()
       WHERE event_id = $1`,
      [eventId]
    );
    return;
  }

  const event = outboxEvents.find(item => item.eventId === eventId);
  if (event) {
    event.status = "PROCESSED";
    event.processedAt = new Date().toISOString();
  }
}

async function markOutboxFailed(eventId, error) {
  if (isDatabaseConfigured()) {
    await query(
      `UPDATE outbox_events
       SET status = 'FAILED',
           retry_count = retry_count + 1,
           failed_at = NOW(),
           last_error = $2
       WHERE event_id = $1`,
      [eventId, sanitizeText(error.message)]
    );
    return;
  }

  const event = outboxEvents.find(item => item.eventId === eventId);
  if (event) {
    event.status = "FAILED";
    event.retryCount += 1;
    event.failedAt = new Date().toISOString();
    event.lastError = sanitizeText(error.message);
  }
}

async function listOutboxEvents() {
  if (isDatabaseConfigured()) {
    const result = await query("SELECT * FROM outbox_events ORDER BY created_at");
    return result.rows;
  }

  return [...outboxEvents];
}

async function getEventMetrics() {
  if (isDatabaseConfigured()) {
    const result = await query(`
      SELECT
        event_type,
        status,
        COUNT(*)::int AS count
      FROM outbox_events
      GROUP BY event_type, status
    `);

    return result.rows;
  }

  return outboxEvents.reduce((metrics, event) => {
    metrics.push({
      event_type: event.eventType,
      status: event.status,
      count: 1
    });
    return metrics;
  }, []);
}

module.exports = {
  getEventMetrics,
  listOutboxEvents,
  markOutboxFailed,
  markOutboxProcessed,
  saveOutboxEvent
};
