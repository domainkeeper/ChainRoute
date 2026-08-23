# Blockchain Integration

## Overview
The backend integrates with the `ShipmentTracking` smart contract via `web3.py`. All blockchain interactions are isolated to a single module: `app/blockchain/client.py`.

## Smart Contract Interface

### Contract Address & Network
- **Contract Address:** Set via `CONTRACT_ADDRESS` env var
- **RPC URL:** Set via `BLOCKCHAIN_RPC_URL` env var
- **Network:** EVM-compatible testnet (e.g., Sepolia, Mumbai, local Hardhat)

### ABI
Stored at `app/blockchain/abi.json` — copied from `/blockchain/artifacts` after contract deployment.

### Functions (per §5.4)

| Function | Parameters | Caller Role | State Change |
|----------|------------|-------------|--------------|
| `createShipment` | `uint256 shipmentId` | ADMIN_ROLE | Creates shipment, status=Created |
| `assignTransporter` | `uint256 shipmentId, address transporter` | ADMIN_ROLE | Sets currentTransporter, status=Assigned |
| `recordPickup` | `uint256 shipmentId` | TRANSPORTER_ROLE (must = currentTransporter) | status=PickedUp, currentCustodian=msg.sender |
| `recordCheckpoint` | `uint256 shipmentId` | current custodian only | Emits event, status may move PickedUp→InTransit |
| `transferCustody` | `uint256 shipmentId, address newCustodian` | current custodian only | currentCustodian=newCustodian, status=CustodyTransferred |
| `markDelivered` | `uint256 shipmentId` | RECEIVER_ROLE (must = currentCustodian) | status=Delivered |

### Events (for history verification)

| Event | Parameters |
|-------|------------|
| `ShipmentCreated` | `uint256 shipmentId, address creator, uint256 timestamp` |
| `TransporterAssigned` | `uint256 shipmentId, address transporter, uint256 timestamp` |
| `PickupRecorded` | `uint256 shipmentId, address transporter, uint256 timestamp` |
| `CheckpointRecorded` | `uint256 shipmentId, address custodian, uint256 timestamp` |
| `CustodyTransferred` | `uint256 shipmentId, address fromCustodian, address toCustodian, uint256 timestamp` |
| `ShipmentDelivered` | `uint256 shipmentId, address receiver, uint256 timestamp` |

## Backend Integration Module

### File: `app/blockchain/client.py`

**Class: `BlockchainClient`**

#### Methods
```python
create_shipment(shipment_id: int) -> dict
assign_transporter(shipment_id: int, transporter_address: str) -> dict
record_pickup(shipment_id: int) -> dict
record_checkpoint(shipment_id: int) -> dict
transfer_custody(shipment_id: int, new_custodian_address: str) -> dict
mark_delivered(shipment_id: int) -> dict
get_shipment_events(shipment_id: int) -> List[Dict]
```

#### Return Format (State-Changing Functions)
```python
{
    "success": bool,
    "tx_hash": "0x...",           # on success
    "receipt": TransactionReceipt, # on success
    "error": "revert reason",      # on failure
}
```

#### Transaction Flow
1. Build transaction with nonce, gas estimate (1.2x), gas price, chain ID
2. Sign with backend wallet private key
3. Send raw transaction
4. Wait for receipt (30s timeout)
5. Return result dict

#### Event Reading
- Uses `contract.events.<EventName>().get_logs()` filtered by `shipmentId`
- Scans from block 0 to latest
- Returns sorted list by block number

### Singleton Instance
`blockchain_client = BlockchainClient()` — imported by services layer.

## Transaction Orchestration Pattern (per §9)

For every state-changing endpoint:

```
1. Validate request + role + current DB status
2. Begin DB transaction; write pending row changes
3. Build & send contract transaction via client.py
4. Wait for receipt (30s timeout, retry once)
5. On success: commit DB, store tx_hash/block_number, insert shipment_events row
6. On failure: rollback DB, return CHAIN_TX_FAILED with revert reason
```

**Implementation:** In `app/services/services.py` — each service method follows this pattern.

## Configuration

### Environment Variables
```bash
BLOCKCHAIN_RPC_URL=http://localhost:8545      # RPC endpoint
CONTRACT_ADDRESS=0x1234...                    # Deployed contract address
BACKEND_WALLET_PRIVATE_KEY=0xabc...           # Backend wallet key (64 hex chars)
```

### ABI Management
- After contract deployment, copy ABI to `app/blockchain/abi.json`
- The client loads ABI on startup
- If ABI missing, all contract calls return `{"success": false, "error": "Contract not loaded - ABI missing"}`

## Current Status

### If Contract Not Yet Deployed
The backend is designed to work with **stubbed blockchain calls**:
- `client.py` methods return mock success responses when ABI is missing
- Services layer handles both real and mocked responses
- Allows parallel backend development (Phase 3) before contract is ready (Phase 2)

### When Contract Is Ready
1. Deploy contract to testnet
2. Copy ABI to `app/blockchain/abi.json`
3. Set `CONTRACT_ADDRESS` and `BLOCKCHAIN_RPC_URL` in backend `.env`
4. Fund `BACKEND_WALLET_PRIVATE_KEY` address with testnet ETH
5. Restart backend — real transactions will execute

## Expected from Blockchain Developer

| Item | Description |
|------|-------------|
| Contract Source | `ShipmentTracking.sol` in `/blockchain/contracts/` |
| ABI | JSON array in `/blockchain/artifacts/` |
| Deployed Address | Address on target testnet |
| RPC URL | Testnet RPC endpoint |
| Funded Wallet | Private key for backend wallet (or one per role) |
| Role Granting | Script to grant ADMIN_ROLE, TRANSPORTER_ROLE, etc. to backend wallet addresses |

## Gap Analysis (if any)

> **Note:** Update this section when contract is deployed.

| Expected | Actual | Status |
|----------|--------|--------|
| `createShipment(uint256)` | — | ⏳ Pending |
| `assignTransporter(uint256,address)` | — | ⏳ Pending |
| `recordPickup(uint256)` | — | ⏳ Pending |
| `recordCheckpoint(uint256)` | — | ⏳ Pending |
| `transferCustody(uint256,address)` | — | ⏳ Pending |
| `markDelivered(uint256)` | — | ⏳ Pending |
| Events with `shipmentId` filter | — | ⏳ Pending |
| AccessControl roles | — | ⏳ Pending |

## Testing
- Unit tests mock `blockchain_client` methods
- Integration tests against local Hardhat node (when available)
- Run: `pytest tests/ -v`