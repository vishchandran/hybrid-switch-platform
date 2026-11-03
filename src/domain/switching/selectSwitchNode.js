function selectSwitchNode({ nodes, statusByNode, nextNodeIndex }) {
  const selectedNode = nodes[nextNodeIndex];
  const followingIndex = (nextNodeIndex + 1) % nodes.length;

  if (statusByNode[selectedNode] === "UP") {
    return { selectedNode, nextNodeIndex: followingIndex };
  }

  const alternateNode = nodes.find(node => statusByNode[node] === "UP");
  return {
    selectedNode: alternateNode || "NO_ACTIVE_NODE",
    nextNodeIndex: followingIndex
  };
}

module.exports = { selectSwitchNode };
