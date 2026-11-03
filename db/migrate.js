const { migrate } = require("../src/infrastructure/persistence/postgres/migrate");
const { closeDatabase } = require("../src/infrastructure/persistence/postgres/postgres");

if (require.main === module) {
  migrate()
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}

module.exports = { migrate };
