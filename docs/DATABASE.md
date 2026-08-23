# Database Schema

## Overview
PostgreSQL database with 6 tables implementing the canonical data model from the architecture document (§6).

## Tables

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() |
| name | TEXT | NOT NULL |
| email | TEXT | NOT NULL, UNIQUE |
| password_hash | TEXT | NOT NULL |
| role | TEXT | NOT NULL, CHECK (role IN ('admin','transporter','warehouse_operator','distributor','receiver','viewer')) |
| wallet_address | TEXT | NULLABLE (EVM address, 42 chars) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() |

**Indexes:** `ix_users_email` (unique)

---

### vehicles
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() |
| plate_number | TEXT | NOT NULL, UNIQUE |
| type | TEXT | NOT NULL |
| transporter_id | UUID | NOT NULL, FK → users.id |

**Indexes:** Primary key, unique on plate_number

---

### shipments
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() |
| chain_shipment_ref | BIGINT | NOT NULL, UNIQUE |
| manufacturer_id | UUID | NOT NULL, FK → users.id |
| origin | TEXT | NOT NULL |
| destination | TEXT | NOT NULL |
| cargo_description | TEXT | NOT NULL |
| quantity | INTEGER | NOT NULL, CHECK (quantity > 0) |
| current_transporter_id | UUID | NULLABLE, FK → users.id |
| current_custodian_id | UUID | NULLABLE, FK → users.id |
| vehicle_id | UUID | NULLABLE, FK → vehicles.id |
| status | TEXT | NOT NULL, DEFAULT 'CREATED', CHECK (status IN ('CREATED','ASSIGNED','PICKED_UP','IN_TRANSIT','AT_WAREHOUSE','CUSTODY_TRANSFERRED','DELIVERED')) |
| qr_code_value | TEXT | NOT NULL, UNIQUE |
| creation_tx_hash | TEXT | NULLABLE (66 chars, 0x-prefixed) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW(), ON UPDATE NOW() |

**Indexes:** 
- `ix_shipments_status` on status
- `ix_shipments_chain_shipment_ref` on chain_shipment_ref
- Unique on chain_shipment_ref, qr_code_value

---

### checkpoints
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() |
| shipment_id | UUID | NOT NULL, FK → shipments.id |
| recorded_by | UUID | NOT NULL, FK → users.id |
| location | TEXT | NOT NULL |
| note | TEXT | NULLABLE |
| tx_hash | TEXT | NULLABLE (66 chars) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() |

**Indexes:** `ix_checkpoints_shipment_id` on shipment_id

---

### custody_transfers
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() |
| shipment_id | UUID | NOT NULL, FK → shipments.id |
| from_user_id | UUID | NOT NULL, FK → users.id |
| to_user_id | UUID | NOT NULL, FK → users.id |
| tx_hash | TEXT | NULLABLE (66 chars) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() |

**Indexes:** `ix_custody_transfers_shipment_id` on shipment_id

---

### shipment_events
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() |
| shipment_id | UUID | NOT NULL, FK → shipments.id |
| event_type | TEXT | NOT NULL, CHECK (event_type IN ('CREATED','ASSIGNED','PICKED_UP','CHECKPOINT','CUSTODY_TRANSFER','DELIVERED')) |
| actor_id | UUID | NOT NULL, FK → users.id |
| tx_hash | TEXT | NULLABLE (66 chars) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() |

**Indexes:** `ix_shipment_events_shipment_id` on shipment_id

---

## Relationships

```
users (1) ←→ (N) vehicles (transporter_id)
users (1) ←→ (N) shipments (manufacturer_id)
users (1) ←→ (N) shipments (current_transporter_id)
users (1) ←→ (N) shipments (current_custodian_id)
users (1) ←→ (N) checkpoints (recorded_by)
users (1) ←→ (N) custody_transfers (from_user_id)
users (1) ←→ (N) custody_transfers (to_user_id)
users (1) ←→ (N) shipment_events (actor_id)

shipments (1) ←→ (N) checkpoints
shipments (1) ←→ (N) custody_transfers
shipments (1) ←→ (N) shipment_events
vehicles (1) ←→ (N) shipments
```

---

## Enum Values

### UserRole (users.role)
- `admin`
- `transporter`
- `warehouse_operator`
- `distributor`
- `receiver`
- `viewer`

### ShipmentStatus (shipments.status)
Ordered lifecycle:
1. `CREATED`
2. `ASSIGNED`
3. `PICKED_UP`
4. `IN_TRANSIT`
5. `AT_WAREHOUSE`
6. `CUSTODY_TRANSFERRED`
7. `DELIVERED`

### EventType (shipment_events.event_type)
- `CREATED`
- `ASSIGNED`
- `PICKED_UP`
- `CHECKPOINT`
- `CUSTODY_TRANSFER`
- `DELIVERED`

---

## Migrations

Managed by Alembic. Migration files in `backend/alembic/versions/`.

### Running Migrations
```bash
cd backend
alembic upgrade head
```

### Creating New Migration
```bash
alembic revision --autogenerate -m "description"
```

### Initial Migration
`001_initial_migration.py` - Creates all 6 tables with indexes and constraints.

---

## Notes

- All UUIDs use PostgreSQL's `gen_random_uuid()` (requires `pgcrypto` extension)
- `shipment_events` is the single append-only log for history view; populated on every state-changing action alongside detailed `checkpoints`/`custody_transfers` rows
- `chain_shipment_ref` is the numeric identifier used on-chain (maps to contract's `shipmentId`)
- `tx_hash` columns store 0x-prefixed transaction hashes (66 chars)
- `wallet_address` stores EVM addresses (42 chars, 0x-prefixed)