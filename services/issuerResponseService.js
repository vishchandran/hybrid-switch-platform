const { authorize } = require("../src/infrastructure/issuer/simulatedIssuerClient");

module.exports = { getIssuerResponse: authorize };
