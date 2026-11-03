const { processOutboxEvent } = require("./outboxProcessor");
const { saveOutboxEvent } = require("../persistence/outboxRepository");
const { topicFor, topicMap } = require("../../application/events/topicMap");

async function publishEvent(eventType, payload) {
  const topic = topicFor(eventType);
  const storedEvent = await saveOutboxEvent({ eventType, topic, payload });

  await processOutboxEvent(storedEvent);

  return storedEvent;
}

module.exports = {
  topicMap,
  publishEvent
};
