const { closeDatabase, ensureSchema, isDatabaseConfigured } = require("./postgres");

async function migrate() {
  if (!isDatabaseConfigured()) {
    console.log("DATABASE_URL is not configured. Nothing to migrate.");
    return;
  }

  await ensureSchema();
  console.log("Database schema is ready.");
}

if (require.main === module) {
  migrate()
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}

module.exports = { migrate };
