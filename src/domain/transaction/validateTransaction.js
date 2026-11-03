const TRANSACTION_TYPES = new Set(["PURCHASE", "CASH_WITHDRAWAL", "BALANCE_INQUIRY"]);
const CHANNELS = new Set(["POS", "ATM"]);
const POS_ENTRY_MODES = new Set(["CHIP", "NFC"]);
const ATM_OWNERSHIP_TYPES = new Set(["ISSUER_ATM", "NON_ISSUER_ATM"]);
const REQUIRED_FIELDS = ["transactionType", "channel", "network", "cardNumber"];

function validateTransaction(transaction) {
  if (!transaction || typeof transaction !== "object" || Array.isArray(transaction)) {
    return "Request body must be a JSON object";
  }

  const missingFields = REQUIRED_FIELDS.filter(
    field => transaction[field] === undefined || transaction[field] === null || transaction[field] === ""
  );
  if (missingFields.length > 0) return `Missing required fields: ${missingFields.join(", ")}`;

  const amountProvided = transaction.amount !== undefined;
  if (transaction.transactionType !== "BALANCE_INQUIRY" && !amountProvided) {
    return "amount is required for purchase and cash withdrawal transactions";
  }
  if (amountProvided && (typeof transaction.amount !== "number" || !Number.isFinite(transaction.amount) || transaction.amount < 0)) {
    return "amount must be a non-negative number";
  }
  if (typeof transaction.cardNumber !== "string" || !/^\d{12,19}$/.test(transaction.cardNumber)) {
    return "cardNumber must be a numeric string between 12 and 19 digits";
  }
  if (!TRANSACTION_TYPES.has(transaction.transactionType)) {
    return "transactionType must be PURCHASE, CASH_WITHDRAWAL, or BALANCE_INQUIRY";
  }
  if (!CHANNELS.has(transaction.channel)) return "channel must be POS or ATM";
  if (transaction.channel === "POS" && !POS_ENTRY_MODES.has(transaction.cardEntryMode)) {
    return "cardEntryMode must be CHIP or NFC for POS transactions";
  }
  if (transaction.channel === "ATM" && !ATM_OWNERSHIP_TYPES.has(transaction.atmOwnership)) {
    return "atmOwnership must be ISSUER_ATM or NON_ISSUER_ATM for ATM transactions";
  }
  if (
    transaction.simulateTimeoutAttempts !== undefined &&
    (!Number.isInteger(transaction.simulateTimeoutAttempts) || transaction.simulateTimeoutAttempts < 0 || transaction.simulateTimeoutAttempts > 2)
  ) {
    return "simulateTimeoutAttempts must be an integer between 0 and 2";
  }
  if (transaction.simulatePostAuthFailure !== undefined && typeof transaction.simulatePostAuthFailure !== "boolean") {
    return "simulatePostAuthFailure must be a boolean";
  }

  return null;
}

module.exports = { validateTransaction };
