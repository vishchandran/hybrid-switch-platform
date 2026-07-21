const { consumeEvent } = require("../consumers/eventConsumerService");
const { getEventQueue } = require("../broker/bullmqConnection");

function getBrokerMode() {
  return process.env.BROKER_MODE || "IN_PROCESS_SIMULATED";
}

async function publishToBroker(event) {
  if (getBrokerMode() === "BULLMQ") {
    const queue = getEventQueue();
    await queue.add(
      event.eventType,
      {
        topic: event.topic,
        eventType: event.eventType,
        payload: event.payload
      },
      {
        jobId: event.eventId,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    );

    return {
      brokerMode: getBrokerMode(),
      delivered: true
    };
  }

  if (getBrokerMode() !== "IN_PROCESS_SIMULATED") {
    throw new Error(`Unsupported broker mode: ${getBrokerMode()}`);
  }

  consumeEvent(event.topic, event.eventType, event.payload);

  return {
    brokerMode: getBrokerMode(),
    delivered: true
  };
}

module.exports = {
  getBrokerMode,
  publishToBroker
};
