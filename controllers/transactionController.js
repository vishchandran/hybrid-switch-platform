const { processTransaction } = require("../services/switchService");
const { getTransaction } = require("../store/transactionStore");
const { saveDeadLetter } = require("../store/deadLetterStore");
const { removeSensitiveFields, sanitizeText } = require("../utils/sensitiveData");

async function createTransaction(req, res) {
  try {
    const result = await processTransaction(req.body);
    const statusCode = result.status === "SYSTEM_UNAVAILABLE" ? 503 : 202;

    return res.status(statusCode).json(result);
  } catch (error) {
    await saveDeadLetter({
      sourceType: "TRANSACTION",
      sourceId: req.header("x-idempotency-key") || null,
      reason: sanitizeText(error.message),
      payload: removeSensitiveFields(req.body),
      retryCount: 0
    });

    return res.status(500).json({
      status: "FAILED",
      reason: "TRANSACTION_PROCESSING_FAILED"
    });
  }
}

async function getTransactionById(req, res) {
  const transaction = await getTransaction(req.params.id);

  if (!transaction) {
    return res.status(404).json({
      status: "NOT_FOUND",
      reason: "TRANSACTION_NOT_FOUND"
    });
  }

  res.status(200).json(transaction);
}

module.exports = {
  createTransaction,
  getTransactionById
};
