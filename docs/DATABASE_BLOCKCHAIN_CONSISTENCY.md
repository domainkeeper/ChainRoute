# Database ↔ Blockchain Consistency

## Overview
This document describes the consistency strategy between PostgreSQL and the blockchain for the ChainRoute prototype. This is a **best-effort prototype-level strategy**, not a distributed ACID transaction.

## Transaction Pattern (per §9)

```
1. Validate request + role + current DB status
2. Begin DB transaction; write pending row changes
3. Build & send contract transaction via web3.py
4. Wait for receipt (30s timeout, retry once)
5. On success: commit DB, store tx_hash/block_number, insert shipment_events row
5. On failure: rollback DB, return CHAIN_TX_FAILED with revert reason
```

---

## Scenario Handling

### 1. DB Write Succeeds, Chain Tx Fails/Reverts
**Result:** DB transaction rolled back, `CHAIN_TX_FAILED` returned to client.

**Implementation:**
- All pending DB changes are in the same SQLAlchemy session
- If `blockchain_client` call returns `success: false` or raises exception
- `await db.rollback()` is called before raising
- No partial state persists

**Error Response:**
```json
{
  "error": {
    "code": "CHAIN_TX_FAILED",
    "message": "Chain transaction failed: execution reverted: <revert reason>"
  }
}
```
HTTP 502

---

### 2. Chain Tx Succeeds, DB Commit Fails
**Result:** **Known edge case** — chain state and DB can diverge.

**How it happens:**
1. Contract transaction confirms on-chain
2. Backend attempts to commit DB transaction
3. DB commit fails (connection loss, constraint violation, etc.)

**Impact:** On-chain event exists but no corresponding DB row. History endpoint will show chain event but not DB record.

**Reconciliation Strategy:**
1. **Background Reconciliation Job** (recommended for production):
   - Periodic job scans recent blocks for contract events
   - For each event, checks if corresponding `shipment_events` row exists by `tx_hash`
   - Inserts missing rows
2. **Admin Re-sync Endpoint** (implemented if time allows):
   - `POST /admin/reconcile/{shipment_id}` — re-reads chain events for a shipment and syncs to DB
   - Or `POST /admin/reconcile-all` — full scan

**Current MVP Status:** Documented as known limitation. No automated reconciliation implemented.

---

### 3. Pending/Unconfirmed Transactions
**Policy:** 30-second timeout with one retry.

**Implementation:**
```python
try:
    receipt = await w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
except TimeExhausted:
    # Retry once
    try:
        receipt = await w3.eth.wait_for_transaction_receipt(tx_hash, timeout=30)
    except TimeExhausted:
        raise ChainTimeoutError("Transaction not confirmed after retry")
```

**Client Behavior:** API request hangs for up to ~60s (30s × 2). Frontend should show loading state.

**Alternative Considered (not implemented):** Async/polling pattern — return `202 Accepted` with polling endpoint. Rejected for MVP simplicity.

---

### 4. Rejected/Reverted Transactions
**Handling:** Revert reason surfaced in error response when available.

**Sources of Revert Reason:**
- Contract `require()` messages
- Custom errors (Solidity 0.8.4+)
- Out-of-gas (no reason)

**Response:**
```json
{
  "error": {
    "code": "CHAIN_TX_FAILED",
    "message": "Chain transaction failed: execution reverted: Caller is not current transporter"
  }
}
```

If no revert reason available:
```json
{
  "error": {
    "code": "CHAIN_TX_FAILED",
    "message": "Chain transaction failed: transaction reverted without reason"
  }
}
```

---

### 5. Duplicate Requests / Idempotency
**Prevention:** State check in Step 1 prevents most double-submits.

**Example:**
- First `POST /pickup` succeeds → status becomes `PICKED_UP`
- Second `POST /pickup` on same shipment:
  - Step 1 checks `status == ASSIGNED`
  - Fails with `INVALID_STATE_TRANSITION` (409)

**Edge Case:** Network retry where client resends request before first response returns.
- Both requests hit Step 1 concurrently (status still `ASSIGNED`)
- Both proceed to Step 2-3
- First to confirm on-chain wins
- Second will revert on-chain (contract requires `status == Assigned`)
- Second request rolls back DB, returns `CHAIN_TX_FAILED`

**Improvement (not in MVP):** Idempotency keys for critical endpoints.

---

## Consistency Guarantees Summary

| Scenario | DB State | Chain State | User Sees |
|----------|----------|-------------|-----------|
| Happy path | Committed | Confirmed | Success + tx_hash |
| Chain revert | Rolled back | Reverted | CHAIN_TX_FAILED |
| Chain timeout | Rolled back | Unknown* | CHAIN_TX_FAILED |
| DB commit fail | Rolled back | Confirmed | 500 (divergence!) |
| Duplicate request | One commits | One confirms | One success, one error |

*Chain timeout: Transaction may still confirm later. Reconciliation job would catch this.

---

## Monitoring & Debugging

### Logs to Capture
- Every state-changing request: `shipment_id`, `action`, `user_id`, `tx_hash`, `result`
- Chain failures: full revert reason, gas used
- Timeouts: which step timed out

### Manual Verification
For any shipment, verify consistency:
```sql
-- Check DB events have matching chain events
SELECT se.tx_hash, se.event_type, se.created_at
FROM shipment_events se
WHERE se.shipment_id = '...';
```
Compare with block explorer for the same `tx_hash`es.

---

## Future Improvements (Post-MVP)
1. Idempotency keys on all write endpoints
2. Background reconciliation job (cron or event-driven)
3. Admin re-sync API
4. Async transaction pattern with webhook/polling
5. Saga pattern compensation for multi-step operations