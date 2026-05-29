function buildSettlementEvent(response, transaction) {
  if (response.status !== "APPROVED") {
    return null;
  }
   if (transaction.transactionType === "BALANCE_INQUIRY") {
    return null;
   }
  return {
    transactionId: response.transactionId,
    status: response.status,
    amount: transaction.amount,
    network: response.network,
    channel: response.channel,
    scenario: response.scenario,
    routedIssuer: response.issuerRouting.routedIssuer,
    settlementRequired: true
  };
}

module.exports = {
  buildSettlementEvent
};