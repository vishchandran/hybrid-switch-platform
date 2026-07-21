const crypto = require("crypto");
const { isDatabaseConfigured, query } = require("../db/postgres");

const reconciliationRecords = [];

async function saveReconciliationRecord({ transactionId, recordType, amount, status, payload }) {
  const record = {
    id: `REC-${crypto.randomUUID()}`,
    transactionId,
    recordType,
    amount: amount || 0,
    status,
    payload,
    createdAt: new Date().toISOString()
  };

  if (isDatabaseConfigured()) {
    await query(
      `INSERT INTO reconciliation_records
        (id, transaction_id, record_type, amount, status, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        record.id,
        record.transactionId,
        record.recordType,
        record.amount,
        record.status,
        record.payload
      ]
    );
  } else {
    reconciliationRecords.push(record);
  }

  return record;
}

async function listReconciliationRecords() {
  if (isDatabaseConfigured()) {
    const result = await query("SELECT * FROM reconciliation_records ORDER BY created_at");
    return result.rows;
  }

  return [...reconciliationRecords];
}

async function getReconciliationMetrics() {
  if (isDatabaseConfigured()) {
    const result = await query(`
      SELECT
        record_type,
        status,
        COUNT(*)::int AS count
      FROM reconciliation_records
      GROUP BY record_type, status
    `);
    return result.rows;
  }

  return reconciliationRecords.map(record => ({
    record_type: record.recordType,
    status: record.status,
    count: 1
  }));
}

module.exports = {
  getReconciliationMetrics,
  listReconciliationRecords,
  saveReconciliationRecord
};
