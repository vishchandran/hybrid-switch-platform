const { getIssuerResponse } = require("./issuerResponseService");
const { resolveScenario } = require("./scenarioResolverService");
const { selectSwitchNode } = require("./switchNodeSelectorService");
const { routeToIssuer } = require("./issuerGatewayService");
const { validatePin } = require("./pinValidationService");
const { authorizeTransaction } = require("./authorizationService");
const { processStandIn } = require("./standInProcessingService");
const { publishEvent } = require("./eventPublisherService");
const { saveTransaction } = require("../store/transactionStore");
const { buildFraudEvent } = require("./fraudEventService");
const { buildSettlementEvent } = require("./settlementEventService");
const { buildAnalyticsEvent } = require("./analyticsEventService");

function processTransaction(transaction) {
  const transactionId = `TXN-${Date.now()}`;
  const switchNode = selectSwitchNode(transactionId);
  const scenario = resolveScenario(transaction);
  const issuerRouting = routeToIssuer(transaction);
  const issuerResponse = getIssuerResponse(transaction);
  if (issuerResponse.status === "TIMEOUT") {
    const standInResult = processStandIn(transaction);
    const response = {
    transactionId,
    switchNode,
    status: standInResult.status,
    reason: standInResult.reason,
    network: transaction.network,
    channel: transaction.channel,
    scenario,
    issuerRouting
  };

  const analyticsEvent = buildAnalyticsEvent(response, transaction);
  saveTransaction(response);

  publishEvent(
    "AUTHORIZATION_EVENT",
    response
  );
  publishEvent(
  "ANALYTICS_EVENT",
  analyticsEvent
);

  return response;
}
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
  switchNode,
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
const analyticsEvent = buildAnalyticsEvent(response, transaction);

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
publishEvent(
  "ANALYTICS_EVENT",
  analyticsEvent
);
return response;
}

module.exports = {
  processTransaction
};