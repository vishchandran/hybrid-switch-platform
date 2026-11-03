const accountRepositoryPort = require("../../application/ports/accountRepository");
const { assertPortAdapter } = require("../../application/ports/definePort");

const accounts = {
  "4000011234567890": {
    accountId: "ACC-ISSUERHOST-001",
    availableBalance: 1500,
    accountStatus: "ACTIVE"
  },
  "4000021234567890": {
    accountId: "ACC-PARTNERA-001",
    availableBalance: 500,
    accountStatus: "ACTIVE"
  }
};

function findByCardNumber(cardNumber) {
  return accounts[cardNumber] || null;
}

module.exports = assertPortAdapter(accountRepositoryPort, {
  findByCardNumber
});
