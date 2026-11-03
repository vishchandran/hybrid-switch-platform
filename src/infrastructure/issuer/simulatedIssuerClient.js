const { evaluateIssuerResponse } = require("../../domain/issuer/evaluateIssuerResponse");

function authorize(transaction) {
  const result = evaluateIssuerResponse({
    timeoutAttempts: transaction.simulateTimeoutAttempts || 0
  });

  for (let attempt = 1; attempt <= result.timedOutAttempts; attempt += 1) {
    console.log(`[RETRY] Attempt ${attempt} timed out`);
  }
  if (result.status === "SUCCESS" && result.attempts > 1) {
    console.log(`[RETRY] Attempt ${result.attempts} succeeded`);
  }

  return { status: result.status };
}

module.exports = { authorize };
