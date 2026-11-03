const { resolveScenario } = require("../../domain/routing/resolveScenario");
const { resolveIssuer } = require("../../domain/routing/resolveIssuer");
const { authorizeTransaction } = require("../../domain/authorization/authorizeTransaction");
const { processStandIn } = require("../../domain/authorization/processStandIn");
const { buildReversalEvent } = require("../../domain/settlement/buildReversalEvent");
const { buildSettlementEvent } = require("../../domain/settlement/buildSettlementEvent");
const { buildFraudEvent } = require("../../domain/risk/buildFraudEvent");
const { buildIso8583Summary } = require("../../domain/messaging/buildIso8583Summary");
const { addLifecycleState, createLifecycle } = require("../../domain/transaction/lifecycle");

function createProcessTransaction(dependencies) {
  const { accountRepository, analyticsEventBuilder, eventPublisher, idGenerator,
    issuerClient, nodeSelector, pinVerifier, reconciliationRepository,
    transactionRepository } = dependencies;

  async function publishAuthorizationAndAnalytics(response, transaction) {
    await eventPublisher.publish("AUTHORIZATION_EVENT", response);
    await eventPublisher.publish("ANALYTICS_EVENT", analyticsEventBuilder(response, transaction));
  }

  return async function processTransaction(transaction) {
    const transactionId = `TXN-${idGenerator.generate()}`;
    const lifecycle = createLifecycle();
    const switchNode = await nodeSelector.selectNode();
    addLifecycleState(lifecycle, "SWITCH_NODE_SELECTED");
    const scenario = resolveScenario(transaction);
    const issuerRouting = resolveIssuer(transaction);
    addLifecycleState(lifecycle, "ISSUER_ROUTED");

    if (switchNode === "NO_ACTIVE_NODE") {
      addLifecycleState(lifecycle, "FAILED_CLOSED");
      const response = { transactionId, switchNode, status: "SYSTEM_UNAVAILABLE",
        reason: "NO_ACTIVE_SWITCH_NODE", network: transaction.network,
        channel: transaction.channel, scenario, issuerRouting, lifecycle };
      response.iso8583 = buildIso8583Summary(transaction, response);
      await transactionRepository.save(response);
      await publishAuthorizationAndAnalytics(response, transaction);
      return response;
    }

    const pinValid = await pinVerifier.verify(transaction.pin);
    addLifecycleState(lifecycle, "PIN_VALIDATED");
    if (!pinValid) {
      addLifecycleState(lifecycle, "DECLINED");
      const response = { transactionId, switchNode, status: "DECLINED",
        reason: "INVALID_PIN", network: transaction.network,
        channel: transaction.channel, scenario, issuerRouting, pinValid, lifecycle };
      response.iso8583 = buildIso8583Summary(transaction, response);
      await transactionRepository.save(response);
      await publishAuthorizationAndAnalytics(response, transaction);
      return response;
    }

    const issuerResponse = await issuerClient.authorize(transaction);
    addLifecycleState(lifecycle, "ISSUER_RESPONSE_EVALUATED");
    if (issuerResponse.status === "TIMEOUT") {
      const standInResult = processStandIn(transaction);
      addLifecycleState(lifecycle, "STAND_IN_APPLIED");
      addLifecycleState(lifecycle, standInResult.status === "APPROVED" ? "APPROVED" : "DECLINED");
      const response = { transactionId, switchNode, status: standInResult.status,
        reason: standInResult.reason, network: transaction.network,
        channel: transaction.channel, scenario, issuerRouting, pinValid, lifecycle };
      response.iso8583 = buildIso8583Summary(transaction, response);
      await transactionRepository.save(response);
      await eventPublisher.publish("AUTHORIZATION_EVENT", response);
      if (response.status === "APPROVED") {
        await eventPublisher.publish("FRAUD_EVENT", buildFraudEvent(response, transaction));
        const settlementEvent = buildSettlementEvent(response, transaction);
        if (settlementEvent) {
          await reconciliationRepository.save({ transactionId, recordType: "SETTLEMENT",
            amount: transaction.amount, status: "PENDING_RECONCILIATION", payload: settlementEvent });
          await eventPublisher.publish("SETTLEMENT_EVENT", settlementEvent);
        }
      }
      await eventPublisher.publish("ANALYTICS_EVENT", analyticsEventBuilder(response, transaction));
      return response;
    }

    const account = await accountRepository.findByCardNumber(transaction.cardNumber);
    const authorizationResult = authorizeTransaction(transaction, account);
    addLifecycleState(lifecycle, "AUTHORIZED");
    const response = { transactionId, switchNode, status: authorizationResult.status,
      reason: authorizationResult.reason, network: transaction.network,
      channel: transaction.channel, scenario, issuerRouting, pinValid, lifecycle };
    response.iso8583 = buildIso8583Summary(transaction, response);
    const fraudEvent = buildFraudEvent(response, transaction);
    const reversalEvent = buildReversalEvent(response, transaction);
    if (reversalEvent) addLifecycleState(lifecycle, "REVERSAL_REQUIRED");
    const settlementEvent = reversalEvent ? null : buildSettlementEvent(response, transaction);
    const analyticsEvent = analyticsEventBuilder(response, transaction);

    await transactionRepository.save(response);
    await eventPublisher.publish("AUTHORIZATION_EVENT", response);
    await eventPublisher.publish("FRAUD_EVENT", fraudEvent);
    if (settlementEvent) {
      await reconciliationRepository.save({ transactionId, recordType: "SETTLEMENT",
        amount: transaction.amount, status: "PENDING_RECONCILIATION", payload: settlementEvent });
      await eventPublisher.publish("SETTLEMENT_EVENT", settlementEvent);
    }
    if (reversalEvent) {
      await reconciliationRepository.save({ transactionId, recordType: "REVERSAL",
        amount: transaction.amount, status: "PENDING_RECONCILIATION", payload: reversalEvent });
      await eventPublisher.publish("REVERSAL_EVENT", reversalEvent);
    }
    await eventPublisher.publish("ANALYTICS_EVENT", analyticsEvent);
    return response;
  };
}

module.exports = { createProcessTransaction };
