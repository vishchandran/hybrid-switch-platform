const { isDatabaseConfigured, query } = require("../src/infrastructure/persistence/postgres/postgres");

const idempotencyRecords = new Map();

async function getIdempotencyRecord(key) {
  if (isDatabaseConfigured()) {
    const result = await query(
      "SELECT request_hash, response, status_code, record_status FROM idempotency_keys WHERE key = $1",
      [key]
    );
    const record = result.rows[0];
    if (!record) {
      return null;
    }

    return {
      requestHash: record.request_hash,
      response: record.response,
      statusCode: record.status_code,
      recordStatus: record.record_status
    };
  }

  return idempotencyRecords.get(key) || null;
}

async function claimIdempotencyKey(key, requestHash) {
  if (isDatabaseConfigured()) {
    const claimed = await query(
      `INSERT INTO idempotency_keys (key, request_hash, record_status)
       VALUES ($1, $2, 'PENDING')
       ON CONFLICT (key) DO NOTHING
       RETURNING key`,
      [key, requestHash]
    );

    if (claimed.rowCount === 1) {
      return { outcome: "CLAIMED" };
    }

    const existing = await getIdempotencyRecord(key);

    if (existing.requestHash !== requestHash) {
      return { outcome: "CONFLICT" };
    }

    if (existing.recordStatus === "PENDING") {
      return { outcome: "IN_PROGRESS" };
    }

    return {
      outcome: "REPLAY",
      record: existing
    };
  }

  const existing = idempotencyRecords.get(key);

  if (!existing) {
    idempotencyRecords.set(key, {
      requestHash,
      recordStatus: "PENDING"
    });
    return { outcome: "CLAIMED" };
  }

  if (existing.requestHash !== requestHash) {
    return { outcome: "CONFLICT" };
  }

  if (existing.recordStatus === "PENDING") {
    return { outcome: "IN_PROGRESS" };
  }

  return {
    outcome: "REPLAY",
    record: existing
  };
}

async function completeIdempotencyRecord(key, record) {
  if (isDatabaseConfigured()) {
    await query(
      `UPDATE idempotency_keys
       SET response = $2,
           status_code = $3,
           record_status = 'COMPLETED'
       WHERE key = $1`,
      [key, record.response, record.statusCode]
    );
    return;
  }

  const existing = idempotencyRecords.get(key);
  idempotencyRecords.set(key, {
    ...existing,
    response: record.response,
    statusCode: record.statusCode,
    recordStatus: "COMPLETED"
  });
}

module.exports = {
  claimIdempotencyKey,
  completeIdempotencyRecord,
  getIdempotencyRecord,
};
