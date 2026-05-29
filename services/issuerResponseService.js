function getIssuerResponse(transaction) {

  const maxRetries = 2;

  if (transaction.simulateTimeout === true) {

    for (let attempt = 1; attempt <= maxRetries; attempt++) {

      console.log(
        `[RETRY] Attempt ${attempt} for issuer response`
      );

    }

    return {
      status: "TIMEOUT"
    };
  }

  return {
    status: "SUCCESS"
  };
}

module.exports = {
  getIssuerResponse
};