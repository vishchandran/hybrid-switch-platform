const switchNodes = ["Switch-A", "Switch-B"];
const { getNodeStatus } = require("./nodeHealthService");

function selectSwitchNode(transactionId) {
  const timestampPart = Number(transactionId.split("-")[1]);
  const nodeIndex = timestampPart % switchNodes.length;

  const selectedNode = switchNodes[nodeIndex];

if (getNodeStatus(selectedNode) === "UP") {
  return selectedNode;
}

const alternateNode = switchNodes.find(
  node => getNodeStatus(node) === "UP"
);

return alternateNode || "NO_ACTIVE_NODE";
}

module.exports = {
  selectSwitchNode
};