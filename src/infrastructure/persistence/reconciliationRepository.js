const reconciliationRepositoryPort = require("../../application/ports/reconciliationRepository");
const { assertPortAdapter } = require("../../application/ports/definePort");
const store = require("../../../store/reconciliationStore");

module.exports = assertPortAdapter(reconciliationRepositoryPort, {
  save: store.saveReconciliationRecord,
  list: store.listReconciliationRecords,
  getMetrics: store.getReconciliationMetrics
});
