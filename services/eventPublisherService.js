const { processOutboxEvent } = require("./outboxProcessorService");
const { saveOutboxEvent } = require("../store/outboxStore");
const { topicFor, topicMap } = require("../src/application/events/topicMap");

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
