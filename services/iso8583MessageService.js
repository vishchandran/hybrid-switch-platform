const PROCESSING_CODES = {
  PURCHASE: "000000",
  CASH_WITHDRAWAL: "010000",
  BALANCE_INQUIRY: "310000"
};

const RESPONSE_CODES = {
  APPROVED: "00",
  DECLINED: "05",
  SYSTEM_UNAVAILABLE: "91"
};

function buildIso8583Summary(transaction, response) {
  return {
    mti: "0100",
    processingCode: PROCESSING_CODES[transaction.transactionType] || "999999",
    amount: transaction.amount || 0,
    network: transaction.network,
    channel: transaction.channel,
    responseMti: "0110",
    responseCode: RESPONSE_CODES[response.status] || "96",
    retrievalReferenceNumber: response.transactionId
  };
}

module.exports = {
  buildIso8583Summary
};
