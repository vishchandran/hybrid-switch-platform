const transactions = {};

function saveTransaction(transaction) {
  transactions[transaction.transactionId] = transaction;
}

function getTransaction(transactionId) {
  return transactions[transactionId];
}

module.exports = {
  saveTransaction,
  getTransaction
};