const { consumeEvent } = require("../consumers/eventConsumerService");
const {
  markOutboxFailed,
  markOutboxProcessed,
  saveOutboxEvent
} = require("../store/outboxStore");
const { saveDeadLetter } = require("../store/deadLetterStore");
const topicMap = {
  AUTHORIZATION_EVENT: "authorization-events",
  FRAUD_EVENT: "fraud-events",
  SETTLEMENT_EVENT: "settlement-events",
  ANALYTICS_EVENT: "analytics-events",
  REVERSAL_EVENT: "reversal-events"
};

async function publishEvent(eventType, payload) {
  const topic = topicMap[eventType] || "unknown-events";
  const storedEvent = await saveOutboxEvent({ eventType, topic, payload });

  try {
    console.log(
      `[TOPIC] ${topic} [EVENT] ${eventType}`,
      JSON.stringify(payload)
    );
    consumeEvent(topic, eventType, payload);
    await markOutboxProcessed(storedEvent.eventId);
  } catch (error) {
    await markOutboxFailed(storedEvent.eventId, error);
    await saveDeadLetter({
      sourceType: "OUTBOX_EVENT",
      sourceId: storedEvent.eventId,
      reason: error.message,
      payload,
      retryCount: storedEvent.retryCount + 1
    });
  }

  return storedEvent;
}

module.exports = {
  topicMap,
  publishEvent
};
