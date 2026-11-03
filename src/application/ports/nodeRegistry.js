const { definePort } = require("./definePort");

module.exports = definePort("NodeRegistry", ["getStatus", "setStatus"]);
