function createTransactionController({
  deadLetterRepository,
  processTransaction,
  sensitiveData,
  transactionRepository
}) {
  async function createTransaction(req, res) {
    try {
      const result = await processTransaction(req.body);
      return res.status(result.status === "SYSTEM_UNAVAILABLE" ? 503 : 202).json(result);
    } catch (error) {
      await deadLetterRepository.save({
        sourceType: "TRANSACTION",
        sourceId: req.header("x-idempotency-key") || null,
        reason: sensitiveData.sanitizeText(error.message),
        payload: sensitiveData.removeSensitiveFields(req.body),
        retryCount: 0
      });
      return res.status(500).json({ status: "FAILED", reason: "TRANSACTION_PROCESSING_FAILED" });
    }
  }

  async function getTransactionById(req, res) {
    const transaction = await transactionRepository.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ status: "NOT_FOUND", reason: "TRANSACTION_NOT_FOUND" });
    }
    return res.status(200).json(transaction);
  }

  return { createTransaction, getTransactionById };
}

module.exports = { createTransactionController };
