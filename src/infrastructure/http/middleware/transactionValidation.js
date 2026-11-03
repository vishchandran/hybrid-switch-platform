const { validateTransaction } = require("../../../domain/transaction/validateTransaction");

function validateTransactionRequest(req, res, next) {
  const error = validateTransaction(req.body);
  if (error) return res.status(400).json({ error });

  return next();
}

module.exports = { validateTransactionRequest };
