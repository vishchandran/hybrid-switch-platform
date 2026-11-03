const { definePort } = require("./definePort");

module.exports = definePort("ReconciliationRepository", ["save", "list", "getMetrics"]);
