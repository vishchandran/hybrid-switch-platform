const { resolveScenario } = require("./scenarioResolverService");
const { routeToIssuer } = require("./issuerGatewayService");
const { validatePin } = require("./pinValidationService");
const { authorizeTransaction } = require("./authorizationService");
const { publishEvent } = require("./eventPublisherService");
const { saveTransaction } = require("../store/transactionStore");
const { buildFraudEvent } = require("./fraudEventService");
const { buildSettlementEvent } = require("./settlementEventService");

function processTransaction(transaction) {
  const transactionId = `TXN-${Date.now()}`;
  const scenario = resolveScenario(transaction);
  const issuerRouting = routeToIssuer(transaction);
  const pinValid = validatePin(transaction.pin);

  if (!pinValid) {
    return {
      transactionId,
      status: "DECLINED",
      reason: "INVALID_PIN",
      network: transaction.network,
      channel: transaction.channel,
      scenario,
      issuerRouting,
      pinValid
    };
  }

  const authorizationResult = authorizeTransaction(transaction);

const response = {
  transactionId,
  status: authorizationResult.status,
  reason: authorizationResult.reason,
  network: transaction.network,
  channel: transaction.channel,
  scenario,
  issuerRouting,
  pinValid
};

const fraudEvent =
  buildFraudEvent(
    response,
    transaction
  );

const settlementEvent = buildSettlementEvent(response, transaction);

saveTransaction(response);

publishEvent(
  "AUTHORIZATION_EVENT",
  response
);
publishEvent(
  "FRAUD_EVENT",
  fraudEvent
);
if (settlementEvent) {
  publishEvent(
    "SETTLEMENT_EVENT",
    settlementEvent
  );
}

return response;
}

module.exports = {
  processTransaction
};