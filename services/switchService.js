const { resolveScenario } = require("./scenarioResolverService");
const { routeToIssuer } = require("./issuerGatewayService");
const { validatePin } = require("./pinValidationService");

function processTransaction(transaction) {
  const transactionId = `TXN-${Date.now()}`;
  const scenario = resolveScenario(transaction);
  const issuerRouting = routeToIssuer(transaction);
  const pinValid = validatePin(transaction.pin);

  return {
    transactionId,
    status: "ACCEPTED",
    network: transaction.network,
    channel: transaction.channel,
    scenario,
    issuerRouting,
    pinValid,
    message: "Transaction accepted by Modern Switch"
  };
}

module.exports = {
  processTransaction
};