# Hybrid Switch Modernization Platform

I built this project to explore what happens inside a payment switch after an ATM or POS transaction arrives. It is a small, conceptual simulation rather than a production payment system, so the focus is on making the processing flow easy to read and experiment with.

The simulator covers routing, authorization, switch-node failover, issuer timeouts, stand-in decisions, reversals, idempotency, durable event recording, and downstream consumer behavior without hiding those ideas behind a large framework.

## What It Demonstrates

- Purchase, cash withdrawal, and balance inquiry requests
- POS and ATM transaction scenarios
- BIN-based issuer routing
- Simple PIN and account authorization checks
- Round-robin selection across two active switch nodes
- Failover when one node is unavailable
- A fail-closed response when both nodes are unavailable
- Simulated issuer timeouts, retries, and stand-in processing
- Authorization, fraud, settlement, reversal, and analytics events
- Topic mapping, an outbox table, and in-process consumer simulation
- Optional PostgreSQL persistence for transactions, idempotency keys, event history, and dead-letter records
- Health, readiness, and simple JSON metrics endpoints

## How A Transaction Moves Through The Simulator

```text
Client request
    |
    v
Request validation and API-key check
    |
    v
Idempotency check
    |
    v
Healthy switch-node selection
    |
    v
BIN routing and issuer response simulation
    |
    v
PIN and account authorization
    |
    v
Event publishing and consumer simulation
```

Events are first written to the outbox model as `PENDING`, then the simulator attempts to consume them in-process. Successful events move to `PROCESSED`. Failed events move to `FAILED` and are copied to the dead-letter model with the failure reason and payload.

If the selected switch node is down, the other node is used. If neither node is available, processing stops immediately and the API returns `503 SYSTEM_UNAVAILABLE`. The request does not continue into issuer authorization.

## Run It Locally

Install dependencies and start the API:

```bash
npm install
CLIENT_API_KEY=dev-client-key ADMIN_API_KEY=dev-admin-key npm start
```

The API runs on `http://localhost:3000` by default. For local development, the keys above are also used as fallbacks when the environment variables are omitted. There are no fallback keys when `NODE_ENV=production`.

PostgreSQL is optional for local demos. If `DATABASE_URL` is set, the app creates the small schema in [db/schema.sql](db/schema.sql) and persists transactions, idempotency keys, outbox events, and dead-letter records there:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/hybrid_switch \
CLIENT_API_KEY=dev-client-key \
ADMIN_API_KEY=dev-admin-key \
npm start
```

If `DATABASE_URL` is not set, the same interfaces use in-memory fallback stores so the simulator remains easy to run during learning and tests.

Check that the service is running:

```bash
curl http://localhost:3000/health
```

Readiness checks the database when one is configured:

```bash
curl http://localhost:3000/ready
```

Simple simulator metrics are available as JSON:

```bash
curl http://localhost:3000/metrics
```

## Try A Transaction

```bash
curl -X POST http://localhost:3000/transactions \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: dev-client-key' \
  -H 'x-idempotency-key: purchase-demo-001' \
  -d '{
    "transactionType": "PURCHASE",
    "channel": "POS",
    "cardEntryMode": "CHIP",
    "network": "INTERAC",
    "cardNumber": "4000011234567890",
    "amount": 25,
    "pin": "1234"
  }'
```

The sample card and PIN are test data built into the simulator. With `cardEntryMode` set to `CHIP`, this request resolves to the `INTERAC_POS_PHYSICAL` scenario. A successful response also includes a UUID-based transaction ID, the selected switch node, the routed issuer, and the authorization result.

Balance inquiries may omit `amount`. Purchases and cash withdrawals require a non-negative numeric amount.

POS requests require `cardEntryMode` set to `CHIP` or `NFC`. ATM requests require `atmOwnership` set to `ISSUER_ATM` or `NON_ISSUER_ATM`.

The optional `x-idempotency-key` header makes retries predictable. Reusing a key with the same body returns the original response; reusing it with a different body returns `409 Conflict`. When `DATABASE_URL` is configured, idempotency records are persisted in PostgreSQL. Without PostgreSQL, they use the local in-memory fallback and reset when the app restarts.

For failure-flow demonstrations, `simulateTimeoutAttempts` accepts an integer from `0` to `2`, and `simulatePostAuthFailure` accepts a boolean. These fields are simulation controls, not payment-network fields.

## Try The Failover Flow

Mark both switch nodes as unavailable:

```bash
curl -X POST http://localhost:3000/admin/node-status \
  -H 'Content-Type: application/json' \
  -H 'x-admin-api-key: dev-admin-key' \
  -d '{"nodeName":"Switch-A","status":"DOWN"}'

curl -X POST http://localhost:3000/admin/node-status \
  -H 'Content-Type: application/json' \
  -H 'x-admin-api-key: dev-admin-key' \
  -d '{"nodeName":"Switch-B","status":"DOWN"}'
```

The next valid transaction returns HTTP `503` with `SYSTEM_UNAVAILABLE`.

Bring the nodes back after the experiment:

```bash
curl -X POST http://localhost:3000/admin/node-status \
  -H 'Content-Type: application/json' \
  -H 'x-admin-api-key: dev-admin-key' \
  -d '{"nodeName":"Switch-A","status":"UP"}'

curl -X POST http://localhost:3000/admin/node-status \
  -H 'Content-Type: application/json' \
  -H 'x-admin-api-key: dev-admin-key' \
  -d '{"nodeName":"Switch-B","status":"UP"}'
```

## Tests

```bash
npm test
```

The tests exercise API-key protection, scenario and simulation validation, idempotency replay/conflict behavior, UUID transaction IDs, balance inquiry behavior, PIN and stand-in handling, reversal events, outbox recording, dead-letter handling, readiness/metrics endpoints, admin validation, and the all-nodes-down path.

## Deliberately Simplified

This repository is meant to explain payment-switch concepts, not reproduce a bank's production environment.

- Accounts and node health live in memory and reset when the process restarts.
- Transactions, idempotency keys, outbox events, and dead letters can persist in PostgreSQL, but the app still supports in-memory fallback for simple local use.
- Issuer calls, timeouts, and retries are synchronous simulations.
- Topics and consumers still run in the same process instead of using a real message broker.
- PIN validation uses a fixed test value; there is no HSM or PIN-block handling.
- BIN ranges, authorization limits, stand-in rules, reversals, and settlement events are small examples.
- API keys and rate limits are intentionally lightweight and process-local.

These choices keep the full flow understandable from a single repository. The PostgreSQL/outbox additions make the simulator more realistic, but they do not make it a production payment switch.

## Hardening Added During Review

The simulator now includes a few practical safety boundaries without changing its educational shape:

- UUID-based transaction IDs instead of timestamp-only IDs
- Separate client and admin API keys
- Validation for transaction fields, amounts, PAN shape, transaction types, and channels
- Conditional validation for POS entry modes and ATM ownership
- Lightweight idempotency for request retries
- PostgreSQL-backed idempotency when `DATABASE_URL` is configured
- Durable transaction, outbox event, and dead-letter models
- Basic readiness and metrics endpoints
- A 10 KB JSON request limit
- Basic transaction and admin rate limits
- Strict node-name and node-status validation
- Fail-closed behavior when no switch node is active
- Automated integration tests for the main request and failure paths

## Production Readiness Gaps

This project should still be described as a simulator. The new persistence and outbox model make it more credible as a learning artifact, but several production concerns remain intentionally out of scope:

- No ISO 8583 message parsing, packing, certification, or network integration
- No HSM, PIN block handling, key ceremony, or PCI-grade cardholder-data controls
- No real message broker such as Kafka, RabbitMQ, or a managed queue
- No distributed locking or coordinated active-active state across app instances
- No reconciliation engine, settlement files, dispute flow, or accounting ledger
- No production monitoring stack, tracing, alerting, dashboards, or runbooks
- No formal migration runner; the simulator applies a small schema automatically
- No secret rotation, audit-grade admin controls, or hardened deployment model

## Possible Next Steps

Natural extensions would be a real broker, explicit outbox replay commands, settlement reconciliation, stronger observability, and a small monitoring view. They are intentionally left as future work so the current project stays focused on the switch flow itself.
