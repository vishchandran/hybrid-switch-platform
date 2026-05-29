function processStandIn(transaction) {
  if (transaction.amount <= 50) {
    return {
      status: "APPROVED",
      reason: "STAND_IN_APPROVED"
    };
  }

  return {
    status: "DECLINED",
    reason: "ISSUER_TIMEOUT"
  };
}

module.exports = {
  processStandIn
};