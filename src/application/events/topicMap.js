const topicMap = Object.freeze({
  AUTHORIZATION_EVENT: "authorization-events",
  FRAUD_EVENT: "fraud-events",
  SETTLEMENT_EVENT: "settlement-events",
  ANALYTICS_EVENT: "analytics-events",
  REVERSAL_EVENT: "reversal-events"
});

function topicFor(eventType) {
  return topicMap[eventType] || "unknown-events";
}

module.exports = { topicFor, topicMap };
