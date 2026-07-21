# Hybrid Switch Modernization Platform

I built this project to explore what happens inside a payment switch after an ATM or POS transaction arrives. It is a small, conceptual simulation rather than a production payment system, so the focus is on making the processing flow easy to read and experiment with.

The simulator covers routing, authorization, switch-node failover, issuer timeouts, stand-in decisions, reversals, idempotency, durable event recording, BullMQ-backed broker publishing, and downstream consumer behavior without hiding those ideas behind a large framework.

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
- Topic mapping, an outbox table, in-process consumer simulation, and optional BullMQ broker mode
- A visible transaction lifecycle so each decision phase is easy to trace
- ISO 8583-shaped authorization/response metadata for learning message semantics
- Reconciliation records for settlement and reversal follow-up
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

Every response includes a small `lifecycle` array. It is not meant to be a production audit log; it is there to make the switch flow easier to reason about. A normal approval moves through states such as `RECEIVED`, `SWITCH_NODE_SELECTED`, `ISSUER_ROUTED`, `PIN_VALIDATED`, `ISSUER_RESPONSE_EVALUATED`, and `AUTHORIZED`.

Events are first written to the outbox model as `PENDING`. A separate outbox processor function then publishes through a broker abstraction. In local mode that broker is still an in-process simulator. When `BROKER_MODE=BULLMQ`, events are published to a Redis-backed BullMQ queue and consumed by `eventWorker.js`. Successful publishes move to `PROCESSED`. Failed publishes move to `FAILED` and are copied to the dead-letter model with the failure reason and payload.

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

To use the BullMQ broker path, run Redis and start the event worker:

```bash
BROKER_MODE=BULLMQ REDIS_URL=redis://localhost:6379 npm run event-worker
```

Then start the API with the same broker settings:

```bash
BROKER_MODE=BULLMQ REDIS_URL=redis://localhost:6379 \
CLIENT_API_KEY=dev-client-key ADMIN_API_KEY=dev-admin-key npm start
```

To apply the small schema explicitly when PostgreSQL is configured:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/hybrid_switch npm run migrate
```

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
curl http://localhost:3000/metrics \
  -H 'x-admin-api-key: dev-admin-key'
```

## Production Mode Guardrails

This project is still a simulator, but production mode now fails closed on the basics instead of silently using demo behavior.

When `NODE_ENV=production`, startup requires:

```text
CLIENT_API_KEY
ADMIN_API_KEY
DATABASE_URL
ALLOWED_ORIGINS
BROKER_MODE=BULLMQ
REDIS_URL or REDIS_HOST
PIN_SECURITY_MODE=EXTERNAL_HSM
HSM_ENDPOINT
```

The development API keys are rejected in production, `/ready` requires a working database connection, `/metrics` requires the admin API key, and transaction requests require a bounded `x-idempotency-key`. CORS is restricted to the comma-separated `ALLOWED_ORIGINS` list. Production mode requires `BROKER_MODE=BULLMQ` and Redis connection settings. PIN validation remains simulated unless a real HSM integration is added, so production startup refuses `SIMULATED_PIN`.

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

The optional `x-idempotency-key` header makes retries predictable. The simulator claims an idempotency key before processing starts, then completes the record with the response. Reusing a completed key with the same body returns the original response; reusing it with a different body returns `409 Conflict`; reusing it while the original request is still processing also returns `409 Conflict`. When `DATABASE_URL` is configured, idempotency records are persisted in PostgreSQL. Without PostgreSQL, they use the local in-memory fallback and reset when the app restarts.

In production mode, `x-idempotency-key` is required.

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

The tests exercise API-key protection, scenario and simulation validation, idempotency replay/conflict behavior, UUID transaction IDs, balance inquiry behavior, PIN and stand-in handling, transaction lifecycle states, reversal events, outbox recording, dead-letter handling, readiness/metrics endpoints, admin validation, and the all-nodes-down path.

## Deliberately Simplified

This repository is meant to explain payment-switch concepts, not reproduce a bank's production environment.

- Accounts and node health live in memory and reset when the process restarts.
- Transactions, idempotency keys, outbox events, and dead letters can persist in PostgreSQL, but the app still supports in-memory fallback for simple local use.
- Issuer calls, timeouts, and retries are synchronous simulations.
- Topics and consumers can run in the same process for local learning, or through BullMQ/Redis when `BROKER_MODE=BULLMQ`.
- PIN validation uses a fixed test value; there is no HSM or PIN-block handling.
- BIN ranges, authorization limits, stand-in rules, reversals, and settlement events are small examples.
- API keys and rate limits are intentionally lightweight and process-local.
- The development fallback stores and API keys are disabled by production startup checks.
- The broker abstraction defaults to in-process delivery; Kafka and RabbitMQ adapters are still external work.

These choices keep the full flow understandable from a single repository. The PostgreSQL/outbox additions make the simulator more realistic, but they do not make it a production payment switch.

## Hardening Added During Review

The simulator now includes a few practical safety boundaries without changing its educational shape:

- UUID-based transaction IDs instead of timestamp-only IDs
- Separate client and admin API keys
- Production startup validation for real API keys, PostgreSQL, and explicit CORS origins
- Validation for transaction fields, amounts, PAN shape, transaction types, and channels
- Conditional validation for POS entry modes and ATM ownership
- Lightweight idempotency for request retries
- Idempotency key claiming before transaction processing
- PostgreSQL-backed idempotency when `DATABASE_URL` is configured
- Durable transaction, outbox event, and dead-letter models
- Separate outbox processor function so the event lifecycle is easier to learn
- BullMQ broker mode and event worker for Redis-backed event delivery
- Broker boundary for adding Kafka or RabbitMQ adapters later
- PostgreSQL advisory-lock based coordination around outbox processing when a database is configured
- ISO 8583-shaped response metadata for authorization examples
- Durable reconciliation records for settlement and reversal examples
- Transaction lifecycle states in API responses
- Basic readiness and metrics endpoints
- Admin-protected metrics endpoint
- Graceful shutdown for the API server and PostgreSQL pool
- Sanitized dead-letter payloads and operational error text
- A 10 KB JSON request limit
- Basic transaction and admin rate limits
- Strict node-name and node-status validation
- Fail-closed behavior when no switch node is active
- Automated integration tests for the main request and failure paths

## Production Readiness Gaps

This project should still be described as a simulator. The new persistence, outbox, broker boundary, ISO-shaped metadata, reconciliation records, and production guardrails make it more credible as a learning artifact, but several production concerns remain intentionally out of scope:

- No certified ISO 8583 parser/packer, scheme certification, or network integration
- No real HSM client, PIN block handling, key ceremony, or PCI-grade cardholder-data controls
- No Kafka or RabbitMQ adapter; BullMQ/Redis is the included broker option
- No full distributed active-active state model across app instances
- No complete reconciliation engine, settlement files, dispute flow, or accounting ledger
- No production monitoring stack, tracing, alerting, dashboards, or runbooks
- No formal migration runner; the simulator applies a small schema automatically
- No secret rotation, audit-grade admin controls, or hardened deployment model
- No production-grade rate limiter shared across multiple instances

## Possible Next Steps

Natural extensions would be Kafka or RabbitMQ adapters, explicit outbox replay commands, settlement reconciliation, stronger observability, and a small monitoring view. They are intentionally left as future work so the current project stays focused on the switch flow itself.
