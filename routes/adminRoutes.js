const express = require("express");
const router = express.Router();

const { updateNodeStatus } = require("../controllers/adminController");

router.post("/node-status", updateNodeStatus);

module.exports = router;