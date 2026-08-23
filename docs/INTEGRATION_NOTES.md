# Frontend Integration Notes

This document provides everything the frontend developer needs to integrate with the ChainRoute backend API. No backend code reading required.

---

## Base Configuration

| Item | Value |
|------|-------|
| **Base URL** | `http://localhost:8000/api/v1` (dev) |
| **Auth** | JWT Bearer token in `Authorization` header |
| **Content-Type** | `application/json` |
| **CORS** | Configured for `http://localhost:3000` |

---

## Authentication Flow

### 1. Login
```javascript
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```javascript
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "name": "John",
    "email": "user@example.com",
    "role": "admin",
    "wallet_address": "0x...",
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

**Store:** Save `access_token` and `refresh_token` in memory (or secure httpOnly cookie).

### 2. Authenticated Requests
```javascript
fetch('/api/v1/shipments', {
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  }
})
```

### 3. Token Refresh
```javascript
POST /auth/refresh
{
  "refresh_token": "eyJ..."
}
```
Returns new `access_token` and `refresh_token`. Call when access token expires (30 min).

### 4. Role Values
User roles (from `user.role`):
- `admin`
- `transporter`
- `warehouse_operator`
- `distributor`
- `receiver`
- `viewer`

---

## Shipment Status Values (Exact Strings)

**7 Statuses — Must match exactly:**
1. `CREATED`
2. `ASSIGNED`
3. `PICKED_UP`
4. `IN_TRANSIT`
5. `AT_WAREHOUSE`
6. `CUSTODY_TRANSFERRED`
7. `DELIVERED`

**Frontend renders actions based on `shipment.status` + `user.role`** — do not encode business rules; backend/contract is authoritative.

---

## API Endpoints Reference

### Create Shipment
```javascript
POST /shipments
Headers: Authorization: Bearer <admin_token>
Body: {
  "origin": "Shanghai, China",
  "destination": "Los Angeles, USA",
  "cargo_description": "Electronics",
  "quantity": 100
}
```
**Response (201):**
```javascript
{
  "shipment": { ... },
  "tx_hash": "0x...",
  "block_number": 12345
}
```
**Errors:** `403 FORBIDDEN_ROLE`, `422 VALIDATION_ERROR`, `502 CHAIN_TX_FAILED`

---

### Assign Transporter
```javascript
POST /shipments/{id}/assign
Headers: Authorization: Bearer <admin_token>
Body: {
  "transporter_id": "uuid",
  "vehicle_id": "uuid"  // optional
}
```
**Precondition:** Shipment status = `CREATED`
**Response (200):** Shipment with `status: "ASSIGNED"`, `current_transporter_id`, `tx_hash`, `block_number`

---

### Record Pickup
```javascript
POST /shipments/{id}/pickup
Headers: Authorization: Bearer <transporter_token>
Body: {}
```
**Precondition:** Shipment status = `ASSIGNED`, caller = `current_transporter_id`
**Response (200):** Shipment with `status: "PICKED_UP"`, `current_custodian_id` = transporter

---

### Record Checkpoint
```javascript
POST /shipments/{id}/checkpoint
Headers: Authorization: Bearer <custodian_token>
Body: {
  "location": "Port of Shanghai",
  "note": "Loaded onto vessel"  // optional
}
```
**Precondition:** Caller = `current_custodian_id`
**Response (200):** Shipment (status may become `IN_TRANSIT` if was `PICKED_UP`)

---

### Transfer Custody (Handoff)
```javascript
POST /shipments/{id}/handoff
Headers: Authorization: Bearer <custodian_token>
Body: {
  "to_user_id": "uuid"
}
```
**Precondition:** Caller = `current_custodian_id`, target user has `wallet_address`
**Response (200):** Shipment with `status: "CUSTODY_TRANSFERRED"`, `current_custodian_id` updated

---

### Mark Delivered
```javascript
POST /shipments/{id}/deliver
Headers: Authorization: Bearer <receiver_token>
Body: {}
```
**Precondition:** Caller = `current_custodian_id` AND role = `receiver`
**Response (200):** Shipment with `status: "DELIVERED"`

---

### Get Shipment Detail
```javascript
GET /shipments/{id}
Headers: Authorization: Bearer <token>
```
**Response (200):** Full shipment object

---

### Lookup by QR Code (Public)
```javascript
GET /shipments/qr/{qr_value}
```
**No auth required.**
**Response (200):** Full shipment object
**Use case:** QR scan → redirect to shipment detail page.

---

### List Shipments
```javascript
GET /shipments?skip=0&limit=20&status_filter=ASSIGNED
Headers: Authorization: Bearer <token>
```
**Response (200):**
```javascript
{
  "shipments": [ ... ],
  "total": 42
}
```

---

### Get History (Public)
```javascript
GET /shipments/{id}/history
```
**No auth required.**
**Response (200):**
```javascript
{
  "events": [
    { "id": "uuid", "event_type": "CREATED", "actor_id": "uuid", "tx_hash": "0x...", "created_at": "..." },
    { "id": "uuid", "event_type": "ASSIGNED", "actor_id": "uuid", "tx_hash": "0x...", "created_at": "..." }
  ],
  "checkpoints": [
    { "id": "uuid", "location": "Port", "note": "Loaded", "tx_hash": "0x...", "created_at": "..." }
  ],
  "custody_transfers": [
    { "id": "uuid", "from_user_id": "uuid", "to_user_id": "uuid", "tx_hash": "0x...", "created_at": "..." }
  ]
}
```
**Note:** `chain_events` from on-chain are also fetched internally and merged for verification — frontend receives the DB-layer unified view.

---

## Response Shapes

### Shipment Object
```javascript
{
  "id": "uuid",
  "chain_shipment_ref": 123456789,
  "manufacturer_id": "uuid",
  "origin": "string",
  "destination": "string",
  "cargo_description": "string",
  "quantity": 100,
  "current_transporter_id": "uuid|null",
  "current_custodian_id": "uuid|null",
  "vehicle_id": "uuid|null",
  "status": "CREATED|ASSIGNED|PICKED_UP|IN_TRANSIT|AT_WAREHOUSE|CUSTODY_TRANSFERRED|DELIVERED",
  "qr_code_value": "CR-123456789",
  "creation_tx_hash": "0x...|null",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

### Write Response (All POST endpoints)
```javascript
{
  "shipment": { ... },  // updated shipment
  "tx_hash": "0x...",
  "block_number": 12345
}
```

---

## Error Handling

All errors follow this format:
```javascript
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Description"
  }
}
```

### Error Codes & HTTP Status

| Code | HTTP | When |
|------|------|------|
| `UNAUTHORIZED` | 401 | Missing/invalid/expired token |
| `FORBIDDEN_ROLE` | 403 | Wrong role or not authorized actor |
| `INVALID_STATE_TRANSITION` | 409 | Shipment not in required pre-state |
| `NOT_FOUND` | 404 | Shipment/user/vehicle not found |
| `CHAIN_TX_FAILED` | 502 | Blockchain transaction failed |
| `VALIDATION_ERROR` | 422 | Invalid request body |

**Handle gracefully:** Show user-friendly messages, disable actions on 409/403, redirect to login on 401.

---

## Nullable Fields Guide

| Field | When Null | When Populated |
|-------|-----------|----------------|
| `current_transporter_id` | Status = `CREATED` | After `assign` (status = `ASSIGNED`) |
| `current_custodian_id` | Status = `CREATED` or `ASSIGNED` | After `pickup` (status = `PICKED_UP`) |
| `vehicle_id` | Not assigned | After `assign` with vehicle |
| `creation_tx_hash` | Never (set on create) | Always after create |
| `tx_hash` on events/checkpoints/transfers | If chain call failed (shouldn't happen) | Always on success |

---

## QR Code Handling

- **Format:** `CR-{chain_shipment_ref}` (e.g., `CR-123456789`)
- **Generation:** Backend generates on create, returns in `qr_code_value`
- **Display:** Frontend generates QR image from this string (use `qrcode` npm package)
- **Scan:** Decode QR → extract value → call `GET /shipments/qr/{value}` → redirect to detail page

---

## Loading States During Chain Confirmation

**All write endpoints wait for blockchain confirmation before responding.**

Typical latency: **5-30 seconds** (testnet).

**Frontend UX Recommendations:**
1. Show spinner/loading overlay on action buttons
2. Disable all action buttons during pending request
3. Show "Confirming on blockchain..." message
4. On success: refresh shipment detail + history
5. On `CHAIN_TX_FAILED`: show error toast, keep user on same page (state unchanged)
6. On timeout (60s): show "Transaction pending — check history shortly"

**Do not** implement optimistic UI updates — wait for backend response.

---

## Action Visibility Matrix

| Status | Admin | Transporter | Warehouse | Distributor | Receiver | Viewer |
|--------|-------|-------------|-----------|-------------|----------|--------|
| CREATED | Assign | — | — | — | — | View |
| ASSIGNED | — | Pickup | — | — | — | View |
| PICKED_UP | — | Checkpoint | Checkpoint* | Checkpoint* | — | View |
| IN_TRANSIT | — | Checkpoint | Checkpoint* | Checkpoint* | — | View |
| AT_WAREHOUSE | — | — | Handoff | Handoff | — | View |
| CUSTODY_TRANSFERRED | — | — | Handoff | Handoff | Deliver** | View |
| DELIVERED | — | — | — | — | — | View |

*If they are current custodian
**Only if they are current custodian AND have receiver role

**Frontend logic:** `if (user.role === 'transporter' && shipment.current_transporter_id === user.id && shipment.status === 'ASSIGNED') showPickup()`

---

## Open Questions / Assumptions

1. **Vehicle Assignment:** `vehicle_id` is optional on assign. If frontend needs to show vehicle info, ensure transporter has vehicles created first.

2. **User Wallet Addresses:** Backend expects `wallet_address` on users for blockchain calls. Admin must set this during user creation/onboarding. No API endpoint exists yet for updating wallet address — may need `/users/{id}/wallet` endpoint.

3. **Admin User Creation:** No self-registration endpoint. Admin users must be created directly in DB or via a script. Login requires pre-existing user.

4. **Shipment ID vs QR Value:** Internal API uses UUID `id`. QR uses `qr_code_value` (`CR-{chain_ref}`). Both resolve to same shipment.

5. **History Chain Events:** Backend fetches on-chain events for verification but returns merged DB view. Frontend can display "Verified on-chain" badges where `tx_hash` exists.

6. **Pagination:** `/shipments` supports `skip`/`limit`. Default limit 100. Implement infinite scroll or pagination.

7. **Real-time Updates:** No WebSocket support in MVP. Poll `/shipments/{id}` or `/history` for updates.

8. **Refresh Token Storage:** Store securely (httpOnly cookie recommended). Access token in memory.

---

## Quick Start Checklist for Frontend

- [ ] Login page → POST `/auth/login` → store tokens
- [ ] Auth wrapper → add `Authorization` header to all requests
- [ ] Token refresh logic → call `/auth/refresh` on 401
- [ ] Dashboard → GET `/shipments` with filters
- [ ] Create Shipment form → POST `/shipments` (admin only)
- [ ] Shipment Detail → GET `/shipments/{id}`
- [ ] QR Display → generate from `qr_code_value`
- [ ] QR Scan → GET `/shipments/qr/{value}` → navigate
- [ ] Action Panels → conditionally render per status/role matrix
- [ ] History Timeline → GET `/shipments/{id}/history` → render events + checkpoints + transfers with tx_hash links
- [ ] Block Explorer Links → `https://sepolia.etherscan.io/tx/{tx_hash}` (adjust for network)
- [ ] Error Handling → parse `error.code`, show appropriate UI
- [ ] Loading States → disable buttons, show spinner on all POST requests