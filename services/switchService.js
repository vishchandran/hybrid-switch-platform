const crypto = require("crypto");
const { createProcessTransaction } = require("../src/application/useCases/processTransaction");
const accountRepository = require("../src/infrastructure/accounts/accountRepository");
const { buildAnalyticsEvent } = require("../src/domain/analytics/buildAnalyticsEvent");
const { publishEvent } = require("./eventPublisherService");
const { authorize: authorizeWithIssuer } = require("../src/infrastructure/issuer/simulatedIssuerClient");
const { selectSwitchNode } = require("./switchNodeSelectorService");
const { validatePin } = require("../src/domain/authorization/validatePin");
const reconciliationRepository = require("../src/infrastructure/persistence/reconciliationRepository");
const transactionRepository = require("../src/infrastructure/persistence/transactionRepository");

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

module.exports = { createProcessTransaction, processTransaction };
