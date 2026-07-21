const crypto = require("crypto");
const { getIssuerResponse } = require("./issuerResponseService");
const { resolveScenario } = require("./scenarioResolverService");
const { selectSwitchNode } = require("./switchNodeSelectorService");
const { routeToIssuer } = require("./issuerGatewayService");
const { validatePin } = require("./pinValidationService");
const { authorizeTransaction } = require("./authorizationService");
const { buildReversalEvent } = require("./reversalEventService");
const { processStandIn } = require("./standInProcessingService");
const { publishEvent } = require("./eventPublisherService");
const { saveTransaction } = require("../store/transactionStore");
const { buildFraudEvent } = require("./fraudEventService");
const { buildSettlementEvent } = require("./settlementEventService");
const { buildAnalyticsEvent } = require("./analyticsEventService");
const { buildIso8583Summary } = require("./iso8583MessageService");
const { saveReconciliationRecord } = require("../store/reconciliationStore");
const {
  addLifecycleState,
  createLifecycle
} = require("./transactionLifecycleService");

async function publishAuthorizationAndAnalytics(response, transaction) {
  await publishEvent("AUTHORIZATION_EVENT", response);
  await publishEvent("ANALYTICS_EVENT", buildAnalyticsEvent(response, transaction));
}

async function processTransaction(transaction) {
  const transactionId = `TXN-${crypto.randomUUID()}`;
  const lifecycle = createLifecycle();
  const switchNode = selectSwitchNode();
  addLifecycleState(lifecycle, "SWITCH_NODE_SELECTED");
  const scenario = resolveScenario(transaction);
  const issuerRouting = routeToIssuer(transaction);
  addLifecycleState(lifecycle, "ISSUER_ROUTED");

  if (switchNode === "NO_ACTIVE_NODE") {
    addLifecycleState(lifecycle, "FAILED_CLOSED");
    const response = {
      transactionId,
      switchNode,
      status: "SYSTEM_UNAVAILABLE",
      reason: "NO_ACTIVE_SWITCH_NODE",
      network: transaction.network,
      channel: transaction.channel,
      scenario,
      issuerRouting,
      lifecycle
    };
    response.iso8583 = buildIso8583Summary(transaction, response);

    await saveTransaction(response);
    await publishAuthorizationAndAnalytics(response, transaction);
    return response;
  }

  const pinValid = validatePin(transaction.pin);
  addLifecycleState(lifecycle, "PIN_VALIDATED");

  if (!pinValid) {
    addLifecycleState(lifecycle, "DECLINED");
    const response = {
      transactionId,
      switchNode,
      status: "DECLINED",
      reason: "INVALID_PIN",
      network: transaction.network,
      channel: transaction.channel,
      scenario,
      issuerRouting,
      pinValid,
      lifecycle
    };
    response.iso8583 = buildIso8583Summary(transaction, response);

    await saveTransaction(response);
    await publishAuthorizationAndAnalytics(response, transaction);
    return response;
  }

  const issuerResponse = getIssuerResponse(transaction);
  addLifecycleState(lifecycle, "ISSUER_RESPONSE_EVALUATED");

  if (issuerResponse.status === "TIMEOUT") {
    const standInResult = processStandIn(transaction);
    addLifecycleState(lifecycle, "STAND_IN_APPLIED");
    addLifecycleState(
      lifecycle,
      standInResult.status === "APPROVED" ? "APPROVED" : "DECLINED"
    );
    const response = {
      transactionId,
      switchNode,
      status: standInResult.status,
      reason: standInResult.reason,
      network: transaction.network,
      channel: transaction.channel,
      scenario,
      issuerRouting,
      pinValid,
      lifecycle
    };
    response.iso8583 = buildIso8583Summary(transaction, response);

    await saveTransaction(response);
    await publishEvent("AUTHORIZATION_EVENT", response);

    if (response.status === "APPROVED") {
      await publishEvent("FRAUD_EVENT", buildFraudEvent(response, transaction));

      const settlementEvent = buildSettlementEvent(response, transaction);
      if (settlementEvent) {
        await saveReconciliationRecord({
          transactionId,
          recordType: "SETTLEMENT",
          amount: transaction.amount,
          status: "PENDING_RECONCILIATION",
          payload: settlementEvent
        });
        await publishEvent("SETTLEMENT_EVENT", settlementEvent);
      }
    }

    await publishEvent("ANALYTICS_EVENT", buildAnalyticsEvent(response, transaction));
    return response;
  }

  const authorizationResult = authorizeTransaction(transaction);
  addLifecycleState(lifecycle, "AUTHORIZED");

  const response = {
    transactionId,
    switchNode,
    status: authorizationResult.status,
    reason: authorizationResult.reason,
    network: transaction.network,
    channel: transaction.channel,
    scenario,
    issuerRouting,
    pinValid,
    lifecycle
  };
  response.iso8583 = buildIso8583Summary(transaction, response);

  const fraudEvent = buildFraudEvent(response, transaction);
  const reversalEvent = buildReversalEvent(response, transaction);
  if (reversalEvent) {
    addLifecycleState(lifecycle, "REVERSAL_REQUIRED");
  }
  const settlementEvent = reversalEvent
    ? null
    : buildSettlementEvent(response, transaction);
  const analyticsEvent = buildAnalyticsEvent(response, transaction);

  await saveTransaction(response);
  await publishEvent("AUTHORIZATION_EVENT", response);
  await publishEvent("FRAUD_EVENT", fraudEvent);

  if (settlementEvent) {
    await saveReconciliationRecord({
      transactionId,
      recordType: "SETTLEMENT",
      amount: transaction.amount,
      status: "PENDING_RECONCILIATION",
      payload: settlementEvent
    });
    await publishEvent("SETTLEMENT_EVENT", settlementEvent);
  }

  if (reversalEvent) {
    await saveReconciliationRecord({
      transactionId,
      recordType: "REVERSAL",
      amount: transaction.amount,
      status: "PENDING_RECONCILIATION",
      payload: reversalEvent
    });
    await publishEvent("REVERSAL_EVENT", reversalEvent);
  }

  await publishEvent("ANALYTICS_EVENT", analyticsEvent);
  return response;
}

module.exports = {
  processTransaction
};
