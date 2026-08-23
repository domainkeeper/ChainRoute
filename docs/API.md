# API Reference

Base URL: `/api/v1`

All endpoints require JWT Bearer token authentication unless marked as **Public**.

---

## Authentication

### POST `/auth/login`
**Public** - Authenticate user and receive JWT tokens

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "user@example.com",
    "role": "admin",
    "wallet_address": "0x...",
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

**Errors:**
- `401 UNAUTHORIZED` - Invalid credentials

---

### POST `/auth/refresh`
**Public** - Refresh access token using refresh token

**Request:**
```json
{
  "refresh_token": "eyJ..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": { ... }
}
```

**Errors:**
- `401 UNAUTHORIZED` - Invalid or expired refresh token

---

## Shipments

### POST `/shipments`
**Auth: admin** - Create a new shipment

**Request:**
```json
{
  "origin": "Shanghai, China",
  "destination": "Los Angeles, USA",
  "cargo_description": "Electronics",
  "quantity": 100
}
```

**Response (201):**
```json
{
  "shipment": {
    "id": "uuid",
    "chain_shipment_ref": 123456789,
    "manufacturer_id": "uuid",
    "origin": "Shanghai, China",
    "destination": "Los Angeles, USA",
    "cargo_description": "Electronics",
    "quantity": 100,
    "current_transporter_id": null,
    "current_custodian_id": null,
    "vehicle_id": null,
    "status": "CREATED",
    "qr_code_value": "CR-123456789",
    "creation_tx_hash": "0x...",
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  },
  "tx_hash": "0x...",
  "block_number": 12345
}
```

**Errors:**
- `401 UNAUTHORIZED` - Invalid/missing token
- `403 FORBIDDEN_ROLE` - User is not admin
- `422 VALIDATION_ERROR` - Invalid request body
- `502 CHAIN_TX_FAILED` - Blockchain transaction failed

---

### POST `/shipments/{id}/assign`
**Auth: admin** - Assign transporter to shipment

**Request:**
```json
{
  "transporter_id": "uuid",
  "vehicle_id": "uuid"  // optional
}
```

**Preconditions:**
- Shipment status must be `CREATED`
- Transporter must have `transporter` role
- Vehicle (if provided) must belong to the transporter

**Response (200):**
```json
{
  "shipment": { ... },  // status = ASSIGNED
  "tx_hash": "0x...",
  "block_number": 12346
}
```

**Errors:**
- `401 UNAUTHORIZED`
- `403 FORBIDDEN_ROLE` - Not admin
- `404 NOT_FOUND` - Shipment or transporter not found
- `409 INVALID_STATE_TRANSITION` - Shipment not in CREATED status
- `422 VALIDATION_ERROR`
- `502 CHAIN_TX_FAILED`

---

### POST `/shipments/{id}/pickup`
**Auth: transporter** - Record pickup by assigned transporter

**Preconditions:**
- Shipment status must be `ASSIGNED`
- Caller must be the `current_transporter_id`

**Response (200):**
```json
{
  "shipment": { ... },  // status = PICKED_UP, current_custodian_id = transporter
  "tx_hash": "0x...",
  "block_number": 12347
}
```

**Errors:**
- `401 UNAUTHORIZED`
- `403 FORBIDDEN_ROLE` - Not transporter or not assigned transporter
- `404 NOT_FOUND`
- `409 INVALID_STATE_TRANSITION` - Shipment not in ASSIGNED status
- `502 CHAIN_TX_FAILED`

---

### POST `/shipments/{id}/checkpoint`
**Auth: current custodian** - Record a checkpoint

**Request:**
```json
{
  "location": "Port of Shanghai",
  "note": "Loaded onto vessel"  // optional
}
```

**Preconditions:**
- Caller must be the `current_custodian_id`

**Response (200):**
```json
{
  "shipment": { ... },  // status may change PICKED_UP → IN_TRANSIT
  "tx_hash": "0x...",
  "block_number": 12348
}
```

**Errors:**
- `401 UNAUTHORIZED`
- `403 FORBIDDEN_ROLE` - Not current custodian
- `404 NOT_FOUND`
- `502 CHAIN_TX_FAILED`

---

### POST `/shipments/{id}/handoff`
**Auth: current custodian** - Transfer custody to another user

**Request:**
```json
{
  "to_user_id": "uuid"
}
```

**Preconditions:**
- Caller must be the `current_custodian_id`
- Target user must have a wallet address configured

**Response (200):**
```json
{
  "shipment": { ... },  // status = CUSTODY_TRANSFERRED, current_custodian_id updated
  "tx_hash": "0x...",
  "block_number": 12349
}
```

**Errors:**
- `401 UNAUTHORIZED`
- `403 FORBIDDEN_ROLE` - Not current custodian
- `404 NOT_FOUND` - Shipment or target user not found
- `502 CHAIN_TX_FAILED`

---

### POST `/shipments/{id}/deliver`
**Auth: receiver** - Mark shipment as delivered

**Preconditions:**
- Caller must be the `current_custodian_id`
- Caller must have `receiver` role

**Response (200):**
```json
{
  "shipment": { ... },  // status = DELIVERED
  "tx_hash": "0x...",
  "block_number": 12350
}
```

**Errors:**
- `401 UNAUTHORIZED`
- `403 FORBIDDEN_ROLE` - Not current custodian or not receiver role
- `404 NOT_FOUND`
- `502 CHAIN_TX_FAILED`

---

### GET `/shipments/{id}`
**Auth: any authenticated** - Get shipment details

**Response (200):**
```json
{
  "id": "uuid",
  "chain_shipment_ref": 123456789,
  "manufacturer_id": "uuid",
  "origin": "Shanghai, China",
  "destination": "Los Angeles, USA",
  "cargo_description": "Electronics",
  "quantity": 100,
  "current_transporter_id": "uuid",
  "current_custodian_id": "uuid",
  "vehicle_id": "uuid",
  "status": "IN_TRANSIT",
  "qr_code_value": "CR-123456789",
  "creation_tx_hash": "0x...",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T01:00:00Z"
}
```

**Errors:**
- `401 UNAUTHORIZED`
- `404 NOT_FOUND`

---

### GET `/shipments/qr/{qr_value}`
**Public** - Lookup shipment by QR code value

**Response (200):** Same as GET `/shipments/{id}`

**Errors:**
- `404 NOT_FOUND`

---

### GET `/shipments`
**Auth: authenticated** - List shipments with optional filtering

**Query Parameters:**
- `skip` (int, default: 0) - Pagination offset
- `limit` (int, default: 100, max: 1000) - Page size
- `status_filter` (string, optional) - Filter by status enum value

**Response (200):**
```json
{
  "shipments": [
    { ... shipment object ... }
  ],
  "total": 42
}
```

**Errors:**
- `401 UNAUTHORIZED`

---

### GET `/shipments/{id}/history`
**Public** - Get complete shipment history (DB + blockchain)

**Response (200):**
```json
{
  "events": [
    {
      "id": "uuid",
      "shipment_id": "uuid",
      "event_type": "CREATED",
      "actor_id": "uuid",
      "tx_hash": "0x...",
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "uuid",
      "shipment_id": "uuid",
      "event_type": "ASSIGNED",
      "actor_id": "uuid",
      "tx_hash": "0x...",
      "created_at": "2026-01-01T01:00:00Z"
    }
  ],
  "checkpoints": [
    {
      "id": "uuid",
      "shipment_id": "uuid",
      "recorded_by": "uuid",
      "location": "Port of Shanghai",
      "note": "Loaded onto vessel",
      "tx_hash": "0x...",
      "created_at": "2026-01-01T02:00:00Z"
    }
  ],
  "custody_transfers": [
    {
      "id": "uuid",
      "shipment_id": "uuid",
      "from_user_id": "uuid",
      "to_user_id": "uuid",
      "tx_hash": "0x...",
      "created_at": "2026-01-01T03:00:00Z"
    }
  ]
}
```

**Errors:**
- `404 NOT_FOUND`

---

## Status Enum Values
Used in `status` field across all endpoints:
- `CREATED`
- `ASSIGNED`
- `PICKED_UP`
- `IN_TRANSIT`
- `AT_WAREHOUSE`
- `CUSTODY_TRANSFERRED`
- `DELIVERED`

---

## Error Response Format
All errors follow this standard envelope:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

### Error Code → HTTP Status Mapping
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing/invalid/expired token |
| `FORBIDDEN_ROLE` | 403 | Role or identity check failed |
| `INVALID_STATE_TRANSITION` | 409 | Shipment not in required pre-state |
| `NOT_FOUND` | 404 | Resource not found |
| `CHAIN_TX_FAILED` | 502 | Blockchain transaction reverted/failed |
| `VALIDATION_ERROR` | 422 | Request body validation failed |

---

## Example Workflow

```bash
# 1. Login as admin
curl -X POST /api/v1/auth/login -d '{"email":"admin@test.com","password":"pass"}'
# → { "access_token": "eyJ...", ... }

# 2. Create shipment
curl -X POST /api/v1/shipments -H "Authorization: Bearer eyJ..." -d '{"origin":"A","destination":"B","cargo_description":"Goods","quantity":10}'
# → { "shipment": {..., "status":"CREATED", "qr_code_value":"CR-123"}, "tx_hash":"0x...", "block_number":123 }

# 3. Assign transporter
curl -X POST /api/v1/shipments/{id}/assign -H "Authorization: Bearer eyJ..." -d '{"transporter_id":"uuid","vehicle_id":"uuid"}'
# → { "shipment": {..., "status":"ASSIGNED"}, "tx_hash":"0x...", "block_number":124 }

# 4. Login as transporter, record pickup
curl -X POST /api/v1/shipments/{id}/pickup -H "Authorization: Bearer transporter_token"
# → { "shipment": {..., "status":"PICKED_UP"}, "tx_hash":"0x...", "block_number":125 }

# 5. Record checkpoint
curl -X POST /api/v1/shipments/{id}/checkpoint -H "Authorization: Bearer transporter_token" -d '{"location":"Port","note":"Loaded"}'
# → { "shipment": {..., "status":"IN_TRANSIT"}, "tx_hash":"0x...", "block_number":126 }

# 6. Transfer custody
curl -X POST /api/v1/shipments/{id}/handoff -H "Authorization: Bearer transporter_token" -d '{"to_user_id":"warehouse_uuid"}'
# → { "shipment": {..., "status":"CUSTODY_TRANSFERRED"}, "tx_hash":"0x...", "block_number":127 }

# 7. Login as receiver, deliver
curl -X POST /api/v1/shipments/{id}/deliver -H "Authorization: Bearer receiver_token"
# → { "shipment": {..., "status":"DELIVERED"}, "tx_hash":"0x...", "block_number":128 }

# 8. View history (public)
curl /api/v1/shipments/{id}/history
# → { "events": [...], "checkpoints": [...], "custody_transfers": [...] }
```