const { app, startServer } = require("./src/main/app");

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
