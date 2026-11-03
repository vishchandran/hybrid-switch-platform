const test = require("node:test");
const assert = require("node:assert/strict");
const { selectSwitchNode } = require("../src/domain/switching/selectSwitchNode");
const { evaluateIssuerResponse } = require("../src/domain/issuer/evaluateIssuerResponse");
const { topicFor } = require("../src/application/events/topicMap");

test("switch selection uses the scheduled healthy node", () => {
  assert.deepEqual(
    selectSwitchNode({
      nodes: ["Switch-A", "Switch-B"],
      statusByNode: { "Switch-A": "UP", "Switch-B": "UP" },
      nextNodeIndex: 0
    }),
    { selectedNode: "Switch-A", nextNodeIndex: 1 }
  );
});

test("switch selection fails over and fails closed", () => {
  assert.equal(
    selectSwitchNode({
      nodes: ["Switch-A", "Switch-B"],
      statusByNode: { "Switch-A": "DOWN", "Switch-B": "UP" },
      nextNodeIndex: 0
    }).selectedNode,
    "Switch-B"
  );
  assert.equal(
    selectSwitchNode({
      nodes: ["Switch-A", "Switch-B"],
      statusByNode: { "Switch-A": "DOWN", "Switch-B": "DOWN" },
      nextNodeIndex: 0
    }).selectedNode,
    "NO_ACTIVE_NODE"
  );
});

test("issuer retry policy succeeds within the limit and times out when exhausted", () => {
  assert.deepEqual(
    evaluateIssuerResponse({ timeoutAttempts: 1, maxRetries: 2 }),
    { status: "SUCCESS", attempts: 2, timedOutAttempts: 1 }
  );
  assert.deepEqual(
    evaluateIssuerResponse({ timeoutAttempts: 2, maxRetries: 2 }),
    { status: "TIMEOUT", attempts: 2, timedOutAttempts: 2 }
  );
});

test("application event routing maps known and unknown event types", () => {
  assert.equal(topicFor("SETTLEMENT_EVENT"), "settlement-events");
  assert.equal(topicFor("UNRECOGNIZED_EVENT"), "unknown-events");
});
