const TRANSACTION_TYPES = new Set([
  "PURCHASE",
  "CASH_WITHDRAWAL",
  "BALANCE_INQUIRY"
]);
const CHANNELS = new Set(["POS", "ATM"]);
const REQUIRED_FIELDS = ["transactionType", "channel", "network", "cardNumber"];

function validateTransactionRequest(req, res, next) {
  const transaction = req.body;

  if (!transaction || typeof transaction !== "object" || Array.isArray(transaction)) {
    return res.status(400).json({ error: "Request body must be a JSON object" });
  }

  const missingFields = REQUIRED_FIELDS.filter(
    field => transaction[field] === undefined || transaction[field] === null || transaction[field] === ""
  );

  if (missingFields.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missingFields.join(", ")}` });
  }

  const amountProvided = transaction.amount !== undefined;
  const amountRequired = transaction.transactionType !== "BALANCE_INQUIRY";

  if (amountRequired && !amountProvided) {
    return res.status(400).json({ error: "amount is required for purchase and cash withdrawal transactions" });
  }

  if (
    amountProvided &&
    (typeof transaction.amount !== "number" ||
      !Number.isFinite(transaction.amount) ||
      transaction.amount < 0)
  ) {
    return res.status(400).json({ error: "amount must be a non-negative number" });
  }

  if (typeof transaction.cardNumber !== "string" || !/^\d{12,19}$/.test(transaction.cardNumber)) {
    return res.status(400).json({ error: "cardNumber must be a numeric string between 12 and 19 digits" });
  }

  if (!TRANSACTION_TYPES.has(transaction.transactionType)) {
    return res.status(400).json({ error: "transactionType must be PURCHASE, CASH_WITHDRAWAL, or BALANCE_INQUIRY" });
  }

  if (!CHANNELS.has(transaction.channel)) {
    return res.status(400).json({ error: "channel must be POS or ATM" });
  }

  return next();
}

module.exports = { validateTransactionRequest };
