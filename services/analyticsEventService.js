function buildAnalyticsEvent(response, transaction) {
  return {
    transactionId: response.transactionId,
    status: response.status,
    reason: response.reason,
    amount: transaction.amount,
    network: response.network,
    channel: response.channel,
    scenario: response.scenario,
    routedIssuer: response.issuerRouting.routedIssuer,
    transactionType: transaction.transactionType,
    cardEntryMode: transaction.cardEntryMode
  };
}

module.exports = {
  buildAnalyticsEvent
};