function buildFraudEvent(response, transaction) {
  return {
    transactionId: response.transactionId,
    status: response.status,
    amount: transaction.amount,
    channel: response.channel,
    scenario: response.scenario,
    routedIssuer: response.issuerRouting.routedIssuer,
    riskIndicator: transaction.amount > 750 ? "HIGH_AMOUNT" : "NORMAL"
  };
}

module.exports = { buildFraudEvent };
