const topicMap = {
  AUTHORIZATION_EVENT: "authorization-events",
  FRAUD_EVENT: "fraud-events",
  SETTLEMENT_EVENT: "settlement-events",
  ANALYTICS_EVENT: "analytics-events",
  REVERSAL_EVENT: "reversal-events"
};

function publishEvent(eventType, payload) {
  const topic = topicMap[eventType] || "unknown-events";

  console.log(
    `[TOPIC] ${topic} [EVENT] ${eventType}`,
    JSON.stringify(payload)
  );
}

module.exports = {
  publishEvent
};