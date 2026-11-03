function processStandIn(transaction) {
  return transaction.amount <= 50
    ? { status: "APPROVED", reason: "STAND_IN_APPROVED" }
    : { status: "DECLINED", reason: "ISSUER_TIMEOUT" };
}

module.exports = { processStandIn };
