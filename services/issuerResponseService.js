function getIssuerResponse(transaction) {
  if (transaction.simulateTimeout === true) {
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