const { definePort } = require("./definePort");

module.exports = definePort("AccountRepository", ["findByCardNumber"]);
