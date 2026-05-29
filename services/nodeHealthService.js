const nodeStatus = {
  "Switch-A": "UP",
  "Switch-B": "UP"
};

function getNodeStatus(nodeName) {
  return nodeStatus[nodeName];
}

function setNodeStatus(nodeName, status) {
  nodeStatus[nodeName] = status;
}

module.exports = {
  getNodeStatus,
  setNodeStatus
};