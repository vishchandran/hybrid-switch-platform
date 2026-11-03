const crypto = require("crypto");
const { createProcessTransaction } = require("../src/application/useCases/processTransaction");
const { getAccount } = require("./accountService");
const { buildAnalyticsEvent } = require("./analyticsEventService");
const { publishEvent } = require("./eventPublisherService");
const { getIssuerResponse } = require("./issuerResponseService");
const { selectSwitchNode } = require("./switchNodeSelectorService");
const { validatePin } = require("../src/domain/authorization/validatePin");
const { saveReconciliationRecord } = require("../store/reconciliationStore");
const { saveTransaction } = require("../store/transactionStore");

const processTransaction = createProcessTransaction({
  accountRepository: { findByCardNumber: getAccount },
  analyticsEventBuilder: buildAnalyticsEvent,
  eventPublisher: { publish: publishEvent },
  idGenerator: { generate: () => crypto.randomUUID() },
  issuerClient: { authorize: getIssuerResponse },
  nodeSelector: { selectNode: selectSwitchNode },
  pinVerifier: { verify: validatePin },
  reconciliationRepository: { save: saveReconciliationRecord },
  transactionRepository: { save: saveTransaction }
});

module.exports = { createProcessTransaction, processTransaction };
