const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : false
    })
  : null;

let schemaReady = false;

function isDatabaseConfigured() {
  return Boolean(pool);
}

async function ensureSchema() {
  if (!pool || schemaReady) {
    return;
  }

  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
  schemaReady = true;
}

async function query(sql, params = []) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured");
  }

  await ensureSchema();
  return pool.query(sql, params);
}

async function checkDatabase() {
  if (!pool) {
    return { configured: false, connected: false };
  }

  try {
    await query("SELECT 1");
    return { configured: true, connected: true };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      error: error.message
    };
  }
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
  }
}

module.exports = {
  checkDatabase,
  closeDatabase,
  ensureSchema,
  isDatabaseConfigured,
  query
};
