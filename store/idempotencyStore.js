const { isDatabaseConfigured, query } = require("../db/postgres");

const idempotencyRecords = new Map();

async function getIdempotencyRecord(key) {
  if (isDatabaseConfigured()) {
    const result = await query(
      "SELECT request_hash, response, status_code FROM idempotency_keys WHERE key = $1",
      [key]
    );
    const record = result.rows[0];
    if (!record) {
      return null;
    }

    return {
      requestHash: record.request_hash,
      response: record.response,
      statusCode: record.status_code
    };
  }

  return idempotencyRecords.get(key) || null;
}

async function saveIdempotencyRecord(key, record) {
  if (isDatabaseConfigured()) {
    await query(
      `INSERT INTO idempotency_keys (key, request_hash, response, status_code)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO NOTHING`,
      [key, record.requestHash, record.response, record.statusCode]
    );
    return;
  }

  idempotencyRecords.set(key, record);
}

module.exports = {
  getIdempotencyRecord,
  saveIdempotencyRecord
};
