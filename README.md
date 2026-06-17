# Hybrid Switch Modernization Platform

A conceptual payment switching simulator that models transaction routing, issuer authorization, resiliency patterns, and event-driven processing commonly used in ATM and POS environments.

The project explores how transaction traffic can be processed across multiple switch nodes, routed to issuers, and recovered during outages while maintaining transaction continuity.

It is a learning and portfolio project, not a production payment switch. The implementation favors small, readable modules that make the processing flow easy to follow.

## Features

- Purchase transactions
- ATM cash withdrawals
- Balance inquiries
- PIN validation
- BIN-based issuer routing
- Authorization and decline handling
- Active-active switch processing
- Automatic failover
- Stand-in processing
- Retry handling
- Settlement event generation
- Event-driven downstream processing

## Architecture

```text
Transaction Channel
        ↓
Switch Layer
        ↓
Issuer Routing
        ↓
Authorization
        ↓
Event Publishing
        ↓
Downstream Services
```

## Example Flows

### Purchase Transaction

```text
POS Transaction
      ↓
Authorization
      ↓
Settlement Event
      ↓
Analytics Event
```

### Issuer Outage

```text
Authorization Request
      ↓
Issuer Timeout
      ↓
Retry
      ↓
Stand-In Processing
      ↓
Approve or Decline
```

### Authorization Reversal

```text
Authorization Approved
      ↓
Processing Failure
      ↓
Reversal Generated
```

## Technology Stack

- Node.js
- Express
- REST APIs

## Running Locally

```bash
npm install
CLIENT_API_KEY=dev-client-key ADMIN_API_KEY=dev-admin-key npm start
```

When these environment variables are omitted outside production, the same development-only keys are used by default. Production mode has no fallback keys and requires explicit values.

## Testing

Run the automated checks with:

```bash
npm test
```

Submit a transaction:

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

Simulate both switch nodes being unavailable:

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

The next valid transaction returns HTTP `503` with `SYSTEM_UNAVAILABLE` and does not continue to issuer authorization.

## Intentional Simplifications

- Transactions, accounts, and node health are stored in memory and reset on restart.
- Issuer timeout and retry behavior is simulated synchronously.
- Event topics and consumers are in-process simulations rather than a message broker.
- PIN validation uses a fixed test value and does not model an HSM or PIN blocks.
- BIN routing, authorization limits, stand-in rules, reversals, and settlement events are simplified examples.
- The API-key and rate-limit middleware is intentionally lightweight and process-local.

## Hardening Added After Review

- UUID-based transaction identifiers replace timestamp-only IDs.
- Processing fails closed when no switch node is active.
- Client and admin APIs require separate API-key headers.
- Transaction requests validate required fields, amounts, PAN shape, transaction types, and channels. Balance inquiries may omit `amount`; financial transactions require it.
- Admin node updates allow only known nodes and `UP`/`DOWN` states.
- JSON request bodies are limited to 10 KB.
- Transaction and admin routes have simple rate limits.
- Automated tests cover authentication, validation, UUIDs, fail-closed behavior, and admin protection.

## Future Enhancements

- Message broker integration
- Persistent event storage
- Dead letter queues
- Settlement reconciliation
- Monitoring dashboard
- Real-time metrics
- Multi-issuer routing

## Purpose

This project was built to better understand payment switch architecture, transaction routing, resiliency patterns, and event-driven processing used in modern payment systems.
