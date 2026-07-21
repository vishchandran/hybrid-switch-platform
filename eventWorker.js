const { consumeEvent } = require("./consumers/eventConsumerService");
const { createEventWorker, closeBroker } = require("./broker/bullmqConnection");

const worker = createEventWorker(async event => {
  consumeEvent(event.topic, event.eventType, event.payload);
});

worker.on("completed", job => {
  console.log(`EVENT_JOB_COMPLETED: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(
    `EVENT_JOB_FAILED: ${job ? job.id : "unknown"}`,
    error.message
  );
});

async function shutdown(signal) {
  console.log(`EVENT_WORKER_SHUTDOWN_STARTED: ${signal}`);
  await worker.close();
  await closeBroker();
  console.log("EVENT_WORKER_SHUTDOWN_COMPLETE");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = worker;
