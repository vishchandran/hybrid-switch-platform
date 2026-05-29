const { setNodeStatus } = require("../services/nodeHealthService");

const validNodes = [
  "Switch-A",
  "Switch-B"
];

function updateNodeStatus(req, res) {
  const { nodeName, status } = req.body;

  if (!nodeName || !status) {
    return res.status(400).json({
      error: "nodeName and status are required"
    });
  }

  if (!validNodes.includes(nodeName)) {
    return res.status(400).json({
      error: "invalid node name"
    });
  }

  if (!["UP", "DOWN"].includes(status)) {
    return res.status(400).json({
      error: "status must be UP or DOWN"
    });
  }

  setNodeStatus(nodeName, status);

  return res.status(200).json({
    message: "Node status updated",
    nodeName,
    status
  });
}

module.exports = {
  updateNodeStatus
};