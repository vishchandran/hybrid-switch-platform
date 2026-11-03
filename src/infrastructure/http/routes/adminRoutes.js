const express = require("express");

function createAdminRoutes(controller) {
  const router = express.Router();
  router.post("/node-status", controller.updateNodeStatus);
  return router;
}

module.exports = { createAdminRoutes };
