const { resolveScenario } = require("./scenarioResolverService");

function processTransaction(transaction) {
  const transactionId = `TXN-${Date.now()}`;
  const scenario = resolveScenario(transaction);

  return {
    transactionId,
    status: "ACCEPTED",
    network: transaction.network,
    channel: transaction.channel,
    scenario,
    message: "Transaction accepted by Modern Switch"
  };
}

module.exports = {
  processTransaction
};