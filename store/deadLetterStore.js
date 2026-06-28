const crypto = require("crypto");
const { isDatabaseConfigured, query } = require("../db/postgres");

const deadLetters = [];

async function saveDeadLetter({ sourceType, sourceId, reason, payload, retryCount = 0 }) {
  const entry = {
    id: `DLQ-${crypto.randomUUID()}`,
    sourceType,
    sourceId,
    reason,
    payload,
    retryCount,
    createdAt: new Date().toISOString()
  };

  if (isDatabaseConfigured()) {
    await query(
      `INSERT INTO dead_letter
        (id, source_type, source_id, reason, payload, retry_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.id,
        entry.sourceType,
        entry.sourceId,
        entry.reason,
        entry.payload,
        entry.retryCount
      ]
    );
  } else {
    deadLetters.push(entry);
  }

  return entry;
}

async function listDeadLetters() {
  if (isDatabaseConfigured()) {
    const result = await query("SELECT * FROM dead_letter ORDER BY created_at");
    return result.rows;
  }

  return [...deadLetters];
}

module.exports = {
  listDeadLetters,
  saveDeadLetter
};
