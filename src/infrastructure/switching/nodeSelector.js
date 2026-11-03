const switchNodes = ["Switch-A", "Switch-B"];
const { getNodeStatus } = require("./nodeRegistry");
const { selectSwitchNode: applySelectionPolicy } = require("../../domain/switching/selectSwitchNode");

let nextNodeIndex = 0;

function selectSwitchNode() {
  const statusByNode = Object.fromEntries(
    switchNodes.map(node => [node, getNodeStatus(node)])
  );
  const result = applySelectionPolicy({
    nodes: switchNodes,
    statusByNode,
    nextNodeIndex
  });
  nextNodeIndex = result.nextNodeIndex;
  return result.selectedNode;
}

module.exports = {
  selectSwitchNode
};
