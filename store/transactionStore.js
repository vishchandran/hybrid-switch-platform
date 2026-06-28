const { isDatabaseConfigured, query } = require("../db/postgres");

const transactions = {};

async function saveTransaction(transaction) {
  if (isDatabaseConfigured()) {
    await query(
      `INSERT INTO transactions
        (transaction_id, status, reason, switch_node, network, channel, scenario, response)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (transaction_id)
       DO UPDATE SET response = EXCLUDED.response,
                     status = EXCLUDED.status,
                     reason = EXCLUDED.reason`,
      [
        transaction.transactionId,
        transaction.status,
        transaction.reason,
        transaction.switchNode,
        transaction.network,
        transaction.channel,
        transaction.scenario,
        transaction
      ]
    );
  } else {
    transactions[transaction.transactionId] = transaction;
  }
}

async function getTransaction(transactionId) {
  if (isDatabaseConfigured()) {
    const result = await query(
      "SELECT response FROM transactions WHERE transaction_id = $1",
      [transactionId]
    );
    return result.rows[0] && result.rows[0].response;
  }

  return transactions[transactionId];
}

async function getTransactionMetrics() {
  if (isDatabaseConfigured()) {
    const result = await query(`
      SELECT
        COUNT(*)::int AS total_transactions,
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'DECLINED')::int AS declined,
        COUNT(*) FILTER (WHERE status = 'SYSTEM_UNAVAILABLE')::int AS failed,
        COUNT(*) FILTER (WHERE reason = 'STAND_IN_APPROVED')::int AS stand_in_count
      FROM transactions
    `);
    return result.rows[0];
  }

  const values = Object.values(transactions);
  return {
    total_transactions: values.length,
    approved: values.filter(transaction => transaction.status === "APPROVED").length,
    declined: values.filter(transaction => transaction.status === "DECLINED").length,
    failed: values.filter(transaction => transaction.status === "SYSTEM_UNAVAILABLE").length,
    stand_in_count: values.filter(transaction => transaction.reason === "STAND_IN_APPROVED").length
  };
}

module.exports = {
  getTransactionMetrics,
  saveTransaction,
  getTransaction
};
