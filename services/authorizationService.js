const { getAccount } = require("./accountService");

function authorizeTransaction(transaction) {
  const account = getAccount(transaction.cardNumber);

  if (!account) {
    return {
      status: "DECLINED",
      reason: "ACCOUNT_NOT_FOUND"
    };
  }

  if (account.accountStatus !== "ACTIVE") {
    return {
      status: "DECLINED",
      reason: "ACCOUNT_INACTIVE"
    };
  }
  if (transaction.transactionType === "BALANCE_INQUIRY") {
  return {
    status: "APPROVED",
    reason: "BALANCE_INQUIRY_APPROVED",
    accountId: account.accountId,
    availableBalance: account.availableBalance
  };
}

  if (transaction.amount > 1000) {
    return {
      status: "DECLINED",
      reason: "EXCEEDS_LIMIT"
    };
  }

  if (transaction.amount > account.availableBalance) {
    return {
      status: "DECLINED",
      reason: "INSUFFICIENT_FUNDS"
    };
  }

  return {
    status: "APPROVED",
    reason: "APPROVED",
    accountId: account.accountId,
    availableBalance: account.availableBalance
  };
}

module.exports = {
  authorizeTransaction
};