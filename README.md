# Hybrid Switch Modernization Platform

A payment switching simulator that models transaction routing, issuer authorization, resiliency patterns, and event-driven processing commonly used in ATM and POS environments.

The project explores how transaction traffic can be processed across multiple switch nodes, routed to issuers, and recovered during outages while maintaining transaction continuity.

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
node app.js
```

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
