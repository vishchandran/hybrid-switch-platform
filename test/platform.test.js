const test = require("node:test");
const assert = require("node:assert/strict");
const { app } = require("../app");
const { setNodeStatus } = require("../services/nodeHealthService");

process.env.CLIENT_API_KEY = "test-client-key";
process.env.ADMIN_API_KEY = "test-admin-key";

async function withServer(run) {
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function validTransaction(overrides = {}) {
  return {
    transactionType: "PURCHASE",
    channel: "POS",
    network: "INTERAC",
    cardNumber: "4000011234567890",
    amount: 25,
    pin: "1234",
    ...overrides
  };
}

function transactionRequest(baseUrl, transaction, apiKey = "test-client-key") {
  return fetch(`${baseUrl}/transactions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {})
    },
    body: JSON.stringify(transaction)
  });
}

test("transaction API requires a client API key", async () => {
  await withServer(async baseUrl => {
    const response = await transactionRequest(baseUrl, validTransaction(), null);
    assert.equal(response.status, 401);
  });
});

test("invalid transaction request returns a clear 400 response", async () => {
  await withServer(async baseUrl => {
    const response = await transactionRequest(baseUrl, validTransaction({ amount: -1 }));
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /non-negative number/);
  });
});

test("balance inquiry may omit amount", async () => {
  setNodeStatus("Switch-A", "UP");
  setNodeStatus("Switch-B", "UP");

  await withServer(async baseUrl => {
    const transaction = validTransaction({
      transactionType: "BALANCE_INQUIRY",
      channel: "ATM"
    });
    delete transaction.amount;

    const response = await transactionRequest(baseUrl, transaction);
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.status, "APPROVED");
    assert.equal(body.reason, "BALANCE_INQUIRY_APPROVED");
  });
});

test("purchase still requires amount", async () => {
  await withServer(async baseUrl => {
    const transaction = validTransaction();
    delete transaction.amount;

    const response = await transactionRequest(baseUrl, transaction);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /amount is required/);
  });
});

test("transaction IDs are UUID based", async () => {
  setNodeStatus("Switch-A", "UP");
  setNodeStatus("Switch-B", "UP");

  await withServer(async baseUrl => {
    const response = await transactionRequest(baseUrl, validTransaction());
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.match(
      body.transactionId,
      /^TXN-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});

test("processing fails closed when both switch nodes are down", async () => {
  setNodeStatus("Switch-A", "DOWN");
  setNodeStatus("Switch-B", "DOWN");

  try {
    await withServer(async baseUrl => {
      const response = await transactionRequest(baseUrl, validTransaction());
      const body = await response.json();

      assert.equal(response.status, 503);
      assert.equal(body.status, "SYSTEM_UNAVAILABLE");
      assert.equal(body.reason, "NO_ACTIVE_SWITCH_NODE");
    });
  } finally {
    setNodeStatus("Switch-A", "UP");
    setNodeStatus("Switch-B", "UP");
  }
});

test("admin node updates require the admin key and validate input", async () => {
  await withServer(async baseUrl => {
    const unauthorized = await fetch(`${baseUrl}/admin/node-status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nodeName: "Switch-A", status: "DOWN" })
    });
    assert.equal(unauthorized.status, 401);

    const invalid = await fetch(`${baseUrl}/admin/node-status`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-admin-api-key": "test-admin-key"
      },
      body: JSON.stringify({ nodeName: "Switch-C", status: "DOWN" })
    });
    assert.equal(invalid.status, 400);
  });
});
