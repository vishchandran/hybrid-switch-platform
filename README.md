# Hybrid Switch Modernization Platform

This project is an Interac-inspired ATM/POS switch simulator. I built it to show the shape of a modern payment-switch flow without turning the repo into a full banking platform.

It is not a production payment switch. The goal is to make the core ideas visible: routing, authorization, failover, retries, stand-in processing, reversals, idempotency, durable events, and consumer behavior.

## What It Demonstrates

- POS purchases, ATM cash withdrawals, and balance inquiries
- BIN-based issuer routing
- PIN and account authorization simulation
- Active-active switch-node selection across `Switch-A` and `Switch-B`
- Failover when one node is down, and fail-closed behavior when both are down
- Issuer timeout retries and stand-in decisions
- Authorization, fraud, settlement, reversal, and analytics events
- PostgreSQL-backed persistence for transactions, idempotency keys, outbox events, dead letters, and reconciliation records
- Outbox-based event publishing with `PENDING`, `PROCESSED`, and `FAILED` states
- In-process event delivery for local learning, plus BullMQ/Redis broker mode
- Health, readiness, metrics, and basic API hardening

## Transaction Flow

```text
Client request
  -> API key check and request validation
  -> idempotency check
  -> switch node selection
  -> BIN routing
  -> PIN validation
  -> issuer response / retry / stand-in logic
  -> transaction persistence
  -> outbox event storage
  -> event publishing and consumer simulation
```

Every response includes a small lifecycle trail so the decision path is easy to follow. For example, a normal approval moves through states like `RECEIVED`, `SWITCH_NODE_SELECTED`, `ISSUER_ROUTED`, `PIN_VALIDATED`, and `AUTHORIZED`.

If both switch nodes are unavailable, processing stops immediately and returns `503 SYSTEM_UNAVAILABLE`. It does not continue into authorization.

## Run Locally

Install dependencies:

```bash
npm install
```

Start the API in simple local mode:

```bash
CLIENT_API_KEY=dev-client-key ADMIN_API_KEY=dev-admin-key npm start
```

The API runs on `http://localhost:3000`.

For durable simulator mode, set `DATABASE_URL`. PostgreSQL becomes the source for transactions, idempotency records, outbox events, dead letters, and reconciliation records:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/hybrid_switch \
CLIENT_API_KEY=dev-client-key \
ADMIN_API_KEY=dev-admin-key \
npm start
```

Apply the schema explicitly when needed:

```bash
DATABASE_URL=postgres://user:password@localhost:5432/hybrid_switch npm run migrate
```

If `DATABASE_URL` is not set, the app uses in-memory fallback stores only to keep local demos and tests easy. That mode is not durable and is rejected by production startup checks.

## BullMQ Broker Mode

The default broker is an in-process simulator. To use BullMQ, run Redis and start the event worker:

```bash
BROKER_MODE=BULLMQ REDIS_URL=redis://localhost:6379 npm run event-worker
```

Start the API with the same broker settings:

```bash
BROKER_MODE=BULLMQ REDIS_URL=redis://localhost:6379 \
CLIENT_API_KEY=dev-client-key ADMIN_API_KEY=dev-admin-key npm start
```

## Example Requests

Health and readiness:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

Metrics require the admin API key:

```bash
curl http://localhost:3000/metrics \
  -H 'x-admin-api-key: dev-admin-key'
```

POS purchase:

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

ATM balance inquiry:

```bash
curl -X POST http://localhost:3000/transactions \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: dev-client-key' \
  -H 'x-idempotency-key: balance-demo-001' \
  -d '{
    "transactionType": "BALANCE_INQUIRY",
    "channel": "ATM",
    "atmOwnership": "ISSUER_ATM",
    "network": "INTERAC",
    "cardNumber": "4000011234567890",
    "pin": "1234"
  }'
```

POS requests require `cardEntryMode` of `CHIP` or `NFC`. ATM requests require `atmOwnership` of `ISSUER_ATM` or `NON_ISSUER_ATM`. Purchases and cash withdrawals require a non-negative numeric `amount`; balance inquiries may omit `amount`.

The `x-idempotency-key` header makes retries predictable. Reusing the same key with the same request body returns the original response. Reusing the same key with a different body returns `409 Conflict`. In production mode, the header is required.

Simulation-only fields:

- `simulateTimeoutAttempts`: integer from `0` to `2`
- `simulatePostAuthFailure`: boolean

## Node Failover Demo

Mark both nodes down:

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

The next valid transaction returns `503 SYSTEM_UNAVAILABLE`.

Bring them back:

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

## Production Mode Guardrails

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

Production mode also rejects development API keys, requires a working database for readiness, restricts CORS, requires Redis-backed broker settings, and refuses simulated PIN security.

These checks make unsafe configuration obvious, but they do not turn this project into a production switch.

## Tests

```bash
npm test
```

The test suite covers request validation, API keys, idempotency replay/conflict behavior, UUID transaction IDs, PIN and stand-in behavior, reversals, outbox recording, dead-letter handling, metrics/readiness, admin validation, and all-nodes-down fail-closed behavior.

## What Is Intentionally Simplified

- No certified ISO 8583 parser, scheme certification, or real network integration
- No real HSM client, PIN block handling, key ceremony, or PCI-grade controls
- No Kafka or RabbitMQ adapter; BullMQ/Redis is the included broker option
- No full distributed active-active state model across app instances
- No complete reconciliation engine, settlement files, dispute flow, or accounting ledger
- No production monitoring stack, tracing, alerting, dashboards, or runbooks
- No formal migration framework; the simulator applies a small schema
- No secret rotation or audit-grade admin controls
- No production-grade shared rate limiter

## Hardening Added

- UUID transaction IDs
- Client/admin API-key separation
- Request size limits, rate limits, and stricter transaction validation
- Conditional POS/ATM scenario validation
- PostgreSQL-backed idempotency and persistence in durable mode
- Durable outbox, dead-letter, and reconciliation models
- BullMQ broker mode and event worker
- PostgreSQL advisory-lock coordination for outbox processing
- Fail-closed node outage behavior
- Sanitized dead-letter payloads and operational error text
- Basic health, readiness, metrics, and integration tests

## Production Readiness Gaps

This is still best described as a strong portfolio-grade simulator. To become a real payment-switch platform, it would need certified messaging, real HSM/PCI controls, external network integration, distributed coordination, operational monitoring, reconciliation operations, deployment hardening, and formal runbooks.
