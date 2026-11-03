const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");

const EVENT_QUEUE_NAME = process.env.EVENT_QUEUE_NAME || "hybrid-switch-events";

let connection;
let queue;

function getRedisConnectionOptions(env = process.env) {
  if (env.REDIS_URL) {
    return {
      connectionString: env.REDIS_URL,
      maxRetriesPerRequest: null
    };
  }

  return {
    host: env.REDIS_HOST || "127.0.0.1",
    port: Number(env.REDIS_PORT) || 6379,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null
  };
}

function getRedisConnection() {
  if (!connection) {
    const options = getRedisConnectionOptions();
    connection = options.connectionString
      ? new IORedis(options.connectionString, { maxRetriesPerRequest: null })
      : new IORedis(options);
  }

  return connection;
}

function getEventQueue() {
  if (!queue) {
    queue = new Queue(EVENT_QUEUE_NAME, {
      connection: getRedisConnection()
    });
  }

  return queue;
}

function createEventWorker(processEvent) {
  return new Worker(
    EVENT_QUEUE_NAME,
    async job => processEvent(job.data),
    {
      connection: getRedisConnection()
    }
  );
}

async function closeBroker() {
  if (queue) {
    await queue.close();
    queue = null;
  }

  if (connection) {
    await connection.quit();
    connection = null;
  }
}

module.exports = {
  EVENT_QUEUE_NAME,
  closeBroker,
  createEventWorker,
  getEventQueue,
  getRedisConnectionOptions
};
