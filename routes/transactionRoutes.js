const express = require("express");
const router = express.Router();
const { validateTransactionRequest } = require("../middleware/transactionValidation");
const { idempotency } = require("../middleware/idempotency");

const {
  createTransaction,
  getTransactionById
} = require("../controllers/transactionController");

router.post("/", validateTransactionRequest, idempotency, createTransaction);
router.get("/:id", getTransactionById);

module.exports = router;
