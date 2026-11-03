function buildReversalEvent(response, transaction) {
  if (response.status !== "APPROVED" || transaction.simulatePostAuthFailure !== true) return null;
  return {
    transactionId: response.transactionId,
    originalStatus: response.status,
    reversalReason: "POST_AUTH_FAILURE",
    amount: transaction.amount,
    network: response.network,
    channel: response.channel,
    routedIssuer: response.issuerRouting.routedIssuer,
    reversalRequired: true
  };
}

module.exports = { buildReversalEvent };
