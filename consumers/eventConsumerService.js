function consumeEvent(topic, eventType, payload) {
  if (topic === "fraud-events") {
    console.log(
      `[CONSUMER] Fraud Consumer processed ${payload.transactionId}`
    );
  }

  if (topic === "settlement-events") {
    console.log(
      `[CONSUMER] Settlement Consumer queued ${payload.transactionId} for reconciliation`
    );
  }

  if (topic === "analytics-events") {
    console.log(
      `[CONSUMER] Analytics Consumer recorded ${payload.transactionId}`
    );
  }

  if (topic === "reversal-events") {
    console.log(
      `[CONSUMER] Reversal Consumer initiated reversal for ${payload.transactionId}`
    );
  }
}

module.exports = {
  consumeEvent
};