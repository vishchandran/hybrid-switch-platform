const transactionRepositoryPort = require("../../application/ports/transactionRepository");
const { assertPortAdapter } = require("../../application/ports/definePort");
const store = require("../../../store/transactionStore");

module.exports = assertPortAdapter(transactionRepositoryPort, {
  save: store.saveTransaction,
  findById: store.getTransaction,
  getMetrics: store.getTransactionMetrics
});
