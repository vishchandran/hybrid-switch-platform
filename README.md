# Hybrid Switch Modernization Platform

I built this project to explore what happens inside a payment switch after an ATM or POS transaction arrives. It is a small, conceptual simulation rather than a production payment system, so the focus is on making the processing flow easy to read and experiment with.

The simulator covers routing, authorization, switch-node failover, issuer timeouts, stand-in decisions, reversals, and downstream events without hiding those ideas behind a large framework or external infrastructure.

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
- Topic mapping and in-process consumer simulation

## How A Transaction Moves Through The Simulator

```text
Client request
    |
    v
Request validation and API-key check
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

If the selected switch node is down, the other node is used. If neither node is available, processing stops immediately and the API returns `503 SYSTEM_UNAVAILABLE`. The request does not continue into issuer authorization.

## Run It Locally

Install dependencies and start the API:

```bash
npm install
CLIENT_API_KEY=dev-client-key ADMIN_API_KEY=dev-admin-key npm start
```

The API runs on `http://localhost:3000` by default. For local development, the keys above are also used as fallbacks when the environment variables are omitted. There are no fallback keys when `NODE_ENV=production`.

Check that the service is running:

```bash
curl http://localhost:3000/health
```

## Try A Transaction

```bash
curl -X POST http://localhost:3000/transactions \
  -H 'Content-Type: application/json' \
  -H 'x-api-key: dev-client-key' \
  -d '{
    "transactionType": "PURCHASE",
    "channel": "POS",
    "network": "INTERAC",
    "cardNumber": "4000011234567890",
    "amount": 25,
    "pin": "1234"
  }'
```

The sample card and PIN are test data built into the simulator. A successful response includes a UUID-based transaction ID, the selected switch node, the routed issuer, and the authorization result.

Balance inquiries may omit `amount`. Purchases and cash withdrawals require a non-negative numeric amount.

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

The tests exercise API-key protection, request validation, UUID transaction IDs, balance inquiry behavior, admin validation, and the all-nodes-down path.

## Deliberately Simplified

This repository is meant to explain payment-switch concepts, not reproduce a bank's production environment.

- Transactions, accounts, and node health live in memory and reset when the process restarts.
- Issuer calls, timeouts, and retries are synchronous simulations.
- Topics and consumers run in the same process instead of using a message broker.
- PIN validation uses a fixed test value; there is no HSM or PIN-block handling.
- BIN ranges, authorization limits, stand-in rules, reversals, and settlement events are small examples.
- API keys and rate limits are intentionally lightweight and process-local.

These choices keep the full flow understandable from a single repository. A production switch would need durable storage, strong key management, distributed coordination, audited financial state, real issuer integrations, and significantly deeper operational controls.

## Hardening Added During Review

The simulator now includes a few practical safety boundaries without changing its educational shape:

- UUID-based transaction IDs instead of timestamp-only IDs
- Separate client and admin API keys
- Validation for transaction fields, amounts, PAN shape, transaction types, and channels
- A 10 KB JSON request limit
- Basic transaction and admin rate limits
- Strict node-name and node-status validation
- Fail-closed behavior when no switch node is active
- Automated integration tests for the main request and failure paths

## Possible Next Steps

Natural extensions would be persistent event storage, replay and dead-letter handling, settlement reconciliation, metrics, and a small monitoring view. They are intentionally left out for now so the current project stays focused on the switch flow itself.
