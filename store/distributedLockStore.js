const crypto = require("crypto");
const { isDatabaseConfigured, query } = require("../db/postgres");

const memoryLocks = new Set();

function lockKey(name) {
  const digest = crypto.createHash("sha256").update(name).digest();
  return digest.readInt32BE(0);
}

async function withDistributedLock(name, run) {
  if (isDatabaseConfigured()) {
    const key = lockKey(name);
    const lock = await query("SELECT pg_try_advisory_lock($1) AS locked", [key]);

    if (!lock.rows[0].locked) {
      throw new Error(`Distributed lock is already held: ${name}`);
    }

    try {
      return await run();
    } finally {
      await query("SELECT pg_advisory_unlock($1)", [key]);
    }
  }

  if (memoryLocks.has(name)) {
    throw new Error(`Distributed lock is already held: ${name}`);
  }

  memoryLocks.add(name);
  try {
    return await run();
  } finally {
    memoryLocks.delete(name);
  }
}

module.exports = {
  lockKey,
  withDistributedLock
};
