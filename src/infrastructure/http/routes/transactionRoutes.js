const express = require("express");
const { validateTransactionRequest } = require("../middleware/transactionValidation");
const { idempotency } = require("../middleware/idempotency");

function createTransactionRoutes(controller) {
  const router = express.Router();
  router.post("/", validateTransactionRequest, idempotency, controller.createTransaction);
  router.get("/:id", controller.getTransactionById);
  return router;
}

module.exports = { createTransactionRoutes };
