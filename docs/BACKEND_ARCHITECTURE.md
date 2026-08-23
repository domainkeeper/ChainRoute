# Backend Architecture

## Overview
The ChainRoute backend is a FastAPI application that serves as the single integration point between the frontend, PostgreSQL database, and the blockchain smart contract. It handles authentication, authorization, business logic, and blockchain transaction orchestration.

## Directory Structure

```
/backend
  /app
    /api          # Route modules per resource (shipments.py, auth.py)
    /models       # SQLAlchemy models
    /schemas      # Pydantic request/response schemas
    /services     # Business logic; orchestrates DB + blockchain
    /blockchain
      client.py   # The ONLY module allowed to import/call web3.py
      abi.json    # Smart contract ABI
    /db
      session.py  # Database session management
      migrations/ # Alembic migrations
    /core
      config.py   # Environment configuration
      security.py # JWT, password hashing utilities
    main.py       # FastAPI application entry point
  /tests          # Pytest test suite
  requirements.txt
  .env.example
  alembic.ini
```

## Layer Responsibilities

### API Layer (`/app/api`)
- Defines REST endpoints under `/api/v1`
- Handles request/response validation via Pydantic schemas
- Enforces authentication and authorization via dependencies
- Returns standardized error responses

### Service Layer (`/app/services`)
- Contains all business logic
- Orchestrates database operations and blockchain calls
- Implements the 6-step transaction pattern from the architecture doc (§9)
- Validates state transitions before any DB/chain writes

### Models Layer (`/app/models`)
- SQLAlchemy models mirroring the database schema (§6)
- Defines enums for UserRole, ShipmentStatus, EventType
- Relationships between entities

### Schemas Layer (`/app/schemas`)
- Pydantic models for request/response validation
- Mirrors the API contract exactly (§7)
- Used for both input validation and output serialization

### Blockchain Layer (`/app/blockchain`)
- `client.py`: Single integration point for `web3.py`
- Exposes methods for each contract function (§5.4)
- Handles transaction signing, sending, and receipt waiting
- Reads on-chain events for history verification
- `abi.json`: Contract ABI copied from `/blockchain/artifacts`

### Database Layer (`/app/db`)
- Async SQLAlchemy session management
- Alembic migrations for schema versioning

### Core Layer (`/app/core`)
- `config.py`: Pydantic Settings for environment variables
- `security.py`: JWT token creation/validation, password hashing

## Data Flow

```
Request → API Route → Service → DB Transaction → Blockchain Client → Smart Contract
                                          ↓
                                   Wait for Receipt
                                          ↓
                                   Commit DB / Rollback
                                          ↓
                                   Return Response
```

## Key Patterns

1. **DB + Chain Consistency**: Every state-changing operation follows the 6-step pattern:
   - Validate request, role, and current DB state
   - Begin DB transaction, write pending changes
   - Build and send contract transaction
   - Wait for receipt (30s timeout, retry once)
   - On success: commit DB, store tx_hash/block_number, log event
   - On failure: rollback DB, return CHAIN_TX_FAILED

2. **Authorization**: Role checks on every write endpoint + identity checks where required (e.g., caller must equal `current_transporter_id` for pickup)

3. **Error Handling**: Standard error envelope with codes: `UNAUTHORIZED`, `FORBIDDEN_ROLE`, `INVALID_STATE_TRANSITION`, `NOT_FOUND`, `CHAIN_TX_FAILED`, `VALIDATION_ERROR`

4. **State Machine**: Strict enforcement of the 7-status lifecycle: `CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → AT_WAREHOUSE → CUSTODY_TRANSFERRED → DELIVERED`