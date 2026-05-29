function getIssuerResponse(transaction) {

  const maxRetries = 2;

  const timeoutAttempts =
    transaction.simulateTimeoutAttempts || 0;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {

    if (attempt <= timeoutAttempts) {

      console.log(
        `[RETRY] Attempt ${attempt} timed out`
      );

      continue;
    }

    if (attempt > 1) {
      console.log(
        `[RETRY] Attempt ${attempt} succeeded`
      );
    }

    return {
      status: "SUCCESS"
    };
  }

  return {
    status: "TIMEOUT"
  };
}

module.exports = {
  getIssuerResponse
};