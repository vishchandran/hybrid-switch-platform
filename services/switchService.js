const crypto = require("crypto");
const { getIssuerResponse } = require("./issuerResponseService");
const { resolveScenario } = require("../src/domain/routing/resolveScenario");
const { selectSwitchNode } = require("./switchNodeSelectorService");
const { resolveIssuer } = require("../src/domain/routing/resolveIssuer");
const { validatePin } = require("../src/domain/authorization/validatePin");
const { authorizeTransaction } = require("../src/domain/authorization/authorizeTransaction");
const { processStandIn } = require("../src/domain/authorization/processStandIn");
const { buildReversalEvent } = require("../src/domain/settlement/buildReversalEvent");
const { publishEvent } = require("./eventPublisherService");
const { saveTransaction } = require("../store/transactionStore");
const { buildFraudEvent } = require("../src/domain/risk/buildFraudEvent");
const { buildSettlementEvent } = require("../src/domain/settlement/buildSettlementEvent");
const { buildAnalyticsEvent } = require("./analyticsEventService");
const { buildIso8583Summary } = require("../src/domain/messaging/buildIso8583Summary");
const { getAccount } = require("./accountService");
const { saveReconciliationRecord } = require("../store/reconciliationStore");
const {
  addLifecycleState,
  createLifecycle
} = require("../src/domain/transaction/lifecycle");

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
  const issuerRouting = resolveIssuer(transaction);
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

  const account = getAccount(transaction.cardNumber);
  const authorizationResult = authorizeTransaction(transaction, account);
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
