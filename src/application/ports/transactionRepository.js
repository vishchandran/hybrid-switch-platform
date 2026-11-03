const { definePort } = require("./definePort");

module.exports = definePort("TransactionRepository", ["save", "findById", "getMetrics"]);
