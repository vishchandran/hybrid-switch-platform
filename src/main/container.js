const crypto = require("crypto");
const { createProcessTransaction } = require("../application/useCases/processTransaction");
const accountRepository = require("../infrastructure/accounts/accountRepository");
const transactionRepository = require("../infrastructure/persistence/transactionRepository");
const reconciliationRepository = require("../infrastructure/persistence/reconciliationRepository");
const sensitiveData = require("../infrastructure/security/sensitiveData");
const { validatePin } = require("../domain/authorization/validatePin");
const { buildAnalyticsEvent } = require("../domain/analytics/buildAnalyticsEvent");
const { publishEvent } = require("../../services/eventPublisherService");
const { authorize: authorizeWithIssuer } = require("../infrastructure/issuer/simulatedIssuerClient");
const { selectSwitchNode } = require("../../services/switchNodeSelectorService");
const { getNodeStatus, setNodeStatus } = require("../../services/nodeHealthService");
const { saveDeadLetter } = require("../../store/deadLetterStore");

function createContainer() {
  const processTransaction = createProcessTransaction({
    accountRepository,
    analyticsEventBuilder: buildAnalyticsEvent,
    eventPublisher: { publish: publishEvent },
    idGenerator: { generate: () => crypto.randomUUID() },
    issuerClient: { authorize: authorizeWithIssuer },
    nodeSelector: { selectNode: selectSwitchNode },
    pinVerifier: { verify: validatePin },
    reconciliationRepository,
    transactionRepository
  });

  return {
    deadLetterRepository: { save: saveDeadLetter },
    nodeRegistry: { getStatus: getNodeStatus, setStatus: setNodeStatus },
    processTransaction,
    sensitiveData,
    transactionRepository
  };
}

module.exports = { createContainer };
