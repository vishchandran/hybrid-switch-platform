const crypto = require("crypto");
const { createProcessTransaction } = require("../src/application/useCases/processTransaction");
const accountRepository = require("../src/infrastructure/accounts/accountRepository");
const { buildAnalyticsEvent } = require("./analyticsEventService");
const { publishEvent } = require("./eventPublisherService");
const { getIssuerResponse } = require("./issuerResponseService");
const { selectSwitchNode } = require("./switchNodeSelectorService");
const { validatePin } = require("../src/domain/authorization/validatePin");
const reconciliationRepository = require("../src/infrastructure/persistence/reconciliationRepository");
const transactionRepository = require("../src/infrastructure/persistence/transactionRepository");

const processTransaction = createProcessTransaction({
  accountRepository,
  analyticsEventBuilder: buildAnalyticsEvent,
  eventPublisher: { publish: publishEvent },
  idGenerator: { generate: () => crypto.randomUUID() },
  issuerClient: { authorize: getIssuerResponse },
  nodeSelector: { selectNode: selectSwitchNode },
  pinVerifier: { verify: validatePin },
  reconciliationRepository,
  transactionRepository
});

module.exports = { createProcessTransaction, processTransaction };
