const { publishToBroker } = require("./brokerService");
const {
  markOutboxFailed,
  markOutboxProcessed
} = require("../store/outboxStore");
const { saveDeadLetter } = require("../store/deadLetterStore");
const { withDistributedLock } = require("../store/distributedLockStore");

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
