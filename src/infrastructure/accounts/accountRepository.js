const accountRepositoryPort = require("../../application/ports/accountRepository");
const { assertPortAdapter } = require("../../application/ports/definePort");
const { getAccount } = require("../../../services/accountService");

module.exports = assertPortAdapter(accountRepositoryPort, {
  findByCardNumber: getAccount
});
