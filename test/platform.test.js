const test = require("node:test");
const assert = require("node:assert/strict");
const { app } = require("../app");
const { setNodeStatus } = require("../services/nodeHealthService");
const { publishEvent } = require("../services/eventPublisherService");
const { listDeadLetters } = require("../store/deadLetterStore");
const { listOutboxEvents } = require("../store/outboxStore");
const { validateProductionConfig } = require("../config/runtimeConfig");
const { removeSensitiveFields, sanitizeText } = require("../utils/sensitiveData");

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
    cardEntryMode: "CHIP",
    network: "INTERAC",
    cardNumber: "4000011234567890",
    amount: 25,
    pin: "1234",
    ...overrides
  };
}

function transactionRequest(
  baseUrl,
  transaction,
  apiKey = "test-client-key",
  idempotencyKey
) {
  return fetch(`${baseUrl}/transactions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
      ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {})
    },
    body: JSON.stringify(transaction)
  });
}

async function capturePublishedEventTypes(run) {
  const originalLog = console.log;
  const eventTypes = [];

  console.log = message => {
    const match = typeof message === "string" && message.match(/\[EVENT\] ([A-Z_]+)/);
    if (match) {
      eventTypes.push(match[1]);
    }
  };

  try {
    return { result: await run(), eventTypes };
  } finally {
    console.log = originalLog;
  }
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
      channel: "ATM",
      atmOwnership: "ISSUER_ATM"
    });
    delete transaction.amount;
    delete transaction.cardEntryMode;

    const response = await transactionRequest(baseUrl, transaction);
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.status, "APPROVED");
    assert.equal(body.reason, "BALANCE_INQUIRY_APPROVED");
    assert.equal(body.scenario, "ISSUER_ATM");
  });
});

test("POS transaction requires cardEntryMode", async () => {
  await withServer(async baseUrl => {
    const transaction = validTransaction();
    delete transaction.cardEntryMode;

    const response = await transactionRequest(baseUrl, transaction);
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /cardEntryMode must be CHIP or NFC/);
  });
});

test("ATM transaction requires atmOwnership", async () => {
  await withServer(async baseUrl => {
    const response = await transactionRequest(
      baseUrl,
      validTransaction({ channel: "ATM" })
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /atmOwnership must be ISSUER_ATM or NON_ISSUER_ATM/);
  });
});

test("NFC POS transaction resolves to the wallet scenario", async () => {
  await withServer(async baseUrl => {
    const response = await transactionRequest(
      baseUrl,
      validTransaction({ cardEntryMode: "NFC" })
    );
    const body = await response.json();

    assert.equal(response.status, 202);
    assert.equal(body.scenario, "INTERAC_POS_WALLET");
  });
});

test("idempotency duplicate returns the original response", async () => {
  await withServer(async baseUrl => {
    const transaction = validTransaction();
    const key = "duplicate-replay-key";
    const first = await transactionRequest(
      baseUrl,
      transaction,
      "test-client-key",
      key
    );
    const firstBody = await first.json();
    const replay = await transactionRequest(
      baseUrl,
      transaction,
      "test-client-key",
      key
    );
    const replayBody = await replay.json();

    assert.equal(replay.status, first.status);
    assert.equal(replay.headers.get("x-idempotent-replay"), "true");
    assert.deepEqual(replayBody, firstBody);
  });
});

test("idempotency key reuse with a different body returns conflict", async () => {
  await withServer(async baseUrl => {
    const key = "duplicate-conflict-key";
    await transactionRequest(
      baseUrl,
      validTransaction(),
      "test-client-key",
      key
    );
    const conflict = await transactionRequest(
      baseUrl,
      validTransaction({ amount: 30 }),
      "test-client-key",
      key
    );
    const body = await conflict.json();

    assert.equal(conflict.status, 409);
    assert.equal(body.status, "CONFLICT");
  });
});

test("invalid idempotency key format returns 400", async () => {
  await withServer(async baseUrl => {
    const response = await transactionRequest(
      baseUrl,
      validTransaction(),
      "test-client-key",
      "bad key with spaces"
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.status, "REJECTED");
  });
});

test("simulateTimeoutAttempts must be an integer between zero and two", async () => {
  await withServer(async baseUrl => {
    const response = await transactionRequest(
      baseUrl,
      validTransaction({ simulateTimeoutAttempts: 3 })
    );

    assert.equal(response.status, 400);
  });
});

test("simulatePostAuthFailure must be boolean", async () => {
  await withServer(async baseUrl => {
    const response = await transactionRequest(
      baseUrl,
      validTransaction({ simulatePostAuthFailure: "true" })
    );

    assert.equal(response.status, 400);
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

test("approved transaction is persisted and can be retrieved", async () => {
  await withServer(async baseUrl => {
    const createResponse = await transactionRequest(baseUrl, validTransaction());
    const created = await createResponse.json();
    const getResponse = await fetch(
      `${baseUrl}/transactions/${created.transactionId}`,
      { headers: { "x-api-key": "test-client-key" } }
    );
    const stored = await getResponse.json();

    assert.equal(createResponse.status, 202);
    assert.equal(getResponse.status, 200);
    assert.deepEqual(stored, created);
    assert.deepEqual(
      stored.lifecycle.map(step => step.state),
      [
        "RECEIVED",
        "SWITCH_NODE_SELECTED",
        "ISSUER_ROUTED",
        "PIN_VALIDATED",
        "ISSUER_RESPONSE_EVALUATED",
        "AUTHORIZED"
      ]
    );
  });
});

test("invalid PIN cannot be stand-in approved after issuer timeout", async () => {
  setNodeStatus("Switch-A", "UP");
  setNodeStatus("Switch-B", "UP");

  await withServer(async baseUrl => {
    const { result, eventTypes } = await capturePublishedEventTypes(() =>
      transactionRequest(
        baseUrl,
        validTransaction({ pin: "WRONG", simulateTimeoutAttempts: 2 })
      )
    );
    const body = await result.json();

    assert.equal(body.status, "DECLINED");
    assert.equal(body.reason, "INVALID_PIN");
    assert.deepEqual(eventTypes, ["AUTHORIZATION_EVENT", "ANALYTICS_EVENT"]);
  });
});

test("invalid PIN decline can be retrieved by transaction ID", async () => {
  await withServer(async baseUrl => {
    const createResponse = await transactionRequest(
      baseUrl,
      validTransaction({ pin: "WRONG" })
    );
    const created = await createResponse.json();
    const getResponse = await fetch(
      `${baseUrl}/transactions/${created.transactionId}`,
      { headers: { "x-api-key": "test-client-key" } }
    );
    const stored = await getResponse.json();

    assert.equal(getResponse.status, 200);
    assert.equal(stored.status, "DECLINED");
    assert.equal(stored.reason, "INVALID_PIN");
  });
});

test("reversal scenario suppresses settlement event", async () => {
  await withServer(async baseUrl => {
    const { result, eventTypes } = await capturePublishedEventTypes(() =>
      transactionRequest(
        baseUrl,
        validTransaction({ simulatePostAuthFailure: true })
      )
    );
    const body = await result.json();

    assert.equal(body.status, "APPROVED");
    assert(eventTypes.includes("REVERSAL_EVENT"));
    assert(!eventTypes.includes("SETTLEMENT_EVENT"));
  });
});

test("stand-in approval publishes settlement event", async () => {
  await withServer(async baseUrl => {
    const { result, eventTypes } = await capturePublishedEventTypes(() =>
      transactionRequest(
        baseUrl,
        validTransaction({ simulateTimeoutAttempts: 2 })
      )
    );
    const body = await result.json();

    assert.equal(body.status, "APPROVED");
    assert.equal(body.reason, "STAND_IN_APPROVED");
    assert.deepEqual(eventTypes, [
      "AUTHORIZATION_EVENT",
      "FRAUD_EVENT",
      "SETTLEMENT_EVENT",
      "ANALYTICS_EVENT"
    ]);
  });
});

test("event publisher stores processed events in the outbox", async () => {
  const before = await listOutboxEvents();
  await publishEvent("AUTHORIZATION_EVENT", {
    transactionId: "TXN-outbox-test",
    status: "APPROVED"
  });
  const after = await listOutboxEvents();
  const storedEvent = after.find(
    event =>
      (event.eventId || event.event_id) &&
      (event.payload.transactionId || event.payload.transaction_id) === "TXN-outbox-test"
  );

  assert.equal(after.length, before.length + 1);
  assert.equal(storedEvent.status, "PROCESSED");
});

test("failed event is marked failed and copied to the dead-letter table", async () => {
  const beforeDeadLetters = await listDeadLetters();
  await publishEvent("ANALYTICS_EVENT", {
    transactionId: "TXN-dlq-test",
    simulateConsumerFailure: true
  });
  const deadLetters = await listDeadLetters();
  const failedEvents = (await listOutboxEvents()).filter(
    event =>
      event.status === "FAILED" &&
      (event.payload.transactionId || event.payload.transaction_id) === "TXN-dlq-test"
  );

  assert.equal(deadLetters.length, beforeDeadLetters.length + 1);
  assert.equal(failedEvents.length, 1);
});

test("readiness and metrics endpoints return simulator status", async () => {
  await withServer(async baseUrl => {
    await transactionRequest(baseUrl, validTransaction());

    const ready = await fetch(`${baseUrl}/ready`);
    const unauthorizedMetrics = await fetch(`${baseUrl}/metrics`);
    const metrics = await fetch(`${baseUrl}/metrics`, {
      headers: { "x-admin-api-key": "test-admin-key" }
    });
    const body = await metrics.json();

    assert.equal(ready.status, 200);
    assert.equal(unauthorizedMetrics.status, 401);
    assert.equal(metrics.status, 200);
    assert(body.totalTransactions >= 1);
    assert(body.approved >= 1);
    assert(body.deadLetterCount >= 1);
    assert(body.failedEventCount >= 1);
    assert(body.eventCounts.AUTHORIZATION_EVENT.PROCESSED >= 1);
  });
});

test("production configuration fails closed without durable dependencies and real keys", () => {
  assert.throws(
    () => validateProductionConfig({ NODE_ENV: "production" }),
    /CLIENT_API_KEY, ADMIN_API_KEY, DATABASE_URL, ALLOWED_ORIGINS/
  );

  assert.throws(
    () =>
      validateProductionConfig({
        NODE_ENV: "production",
        CLIENT_API_KEY: "dev-client-key",
        ADMIN_API_KEY: "real-admin-key",
        DATABASE_URL: "postgres://example",
        ALLOWED_ORIGINS: "https://example.com"
      }),
    /development default/
  );
});

test("sensitive fields are removed from operational payloads and error text", () => {
  const payload = removeSensitiveFields({
    cardNumber: "4000011234567890",
    pin: "1234",
    nested: {
      cardNumber: "4000019999999999"
    },
    amount: 25
  });
  const text = sanitizeText("failed cardNumber=4000011234567890 pin=1234");

  assert.deepEqual(payload, {
    nested: {},
    amount: 25
  });
  assert(!text.includes("4000011234567890"));
  assert(!text.includes("1234"));
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
