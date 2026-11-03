const { publishToBroker } = require("./brokerPublisher");
const {
  markOutboxFailed,
  markOutboxProcessed
} = require("../persistence/outboxRepository");
const { saveDeadLetter } = require("../persistence/deadLetterRepository");
const { withDistributedLock } = require("../persistence/distributedLock");

async function processOutboxEvent(storedEvent) {
  return withDistributedLock(`outbox:${storedEvent.eventId}`, async () => {
    try {
      console.log(
        `[TOPIC] ${storedEvent.topic} [EVENT] ${storedEvent.eventType}`,
        JSON.stringify(storedEvent.payload)
      );

      await publishToBroker(storedEvent);

      await markOutboxProcessed(storedEvent.eventId);
    } catch (error) {
      await markOutboxFailed(storedEvent.eventId, error);
      await saveDeadLetter({
        sourceType: "OUTBOX_EVENT",
        sourceId: storedEvent.eventId,
        reason: error.message,
        payload: storedEvent.payload,
        retryCount: storedEvent.retryCount + 1
      });
    }
  });
}

module.exports = {
  processOutboxEvent
};
