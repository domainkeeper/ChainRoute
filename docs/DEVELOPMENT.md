# Development Guide

## Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Node.js 18+ (for blockchain development)
- Git

---

## Backend Setup

### 1. Clone & Navigate
```bash
cd backend
```

### 2. Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# OR
venv\Scripts\activate     # Windows
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment
```bash
cp .env.example .env
# Edit .env with your values:
# DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/chainroute
# JWT_SECRET=your-secret-key
# BLOCKCHAIN_RPC_URL=http://localhost:8545
# CONTRACT_ADDRESS=0x...
# BACKEND_WALLET_PRIVATE_KEY=0x...
# CORS_ALLOWED_ORIGIN=http://localhost:3000
```

### 5. Create Database
```bash
createdb chainroute
# Or use your preferred method
```

### 6. Run Migrations
```bash
alembic upgrade head
```

### 7. Start Development Server
```bash
uvicorn app.main:app --reload --port 8000
```

Server runs at `http://localhost:8000`
API docs at `http://localhost:8000/docs`

---

## Database Commands

### Create New Migration
```bash
alembic revision --autogenerate -m "description of changes"
```

### Apply Migrations
```bash
alembic upgrade head
```

### Downgrade
```bash
alembic downgrade -1
```

### Check Current Revision
```bash
alembic current
```

### Show History
```bash
alembic history
```

---

## Testing

### Run All Tests
```bash
pytest
```

### Run with Coverage
```bash
pytest --cov=app --cov-report=term-missing
```

### Run Specific Test File
```bash
pytest tests/test_backend.py -v
```

### Run with Asyncio
Tests use `pytest-asyncio` — async tests work automatically.

---

## Blockchain Integration

### Local Development (Hardhat)
```bash
cd ../blockchain
npm install
npx hardhat node
# In another terminal:
npx hardhat run scripts/deploy.js --network localhost
# Copy deployed address to backend .env
```

### Testnet Deployment
```bash
npx hardhat run scripts/deploy.js --network sepolia
# Set CONTRACT_ADDRESS and BLOCKCHAIN_RPC_URL in backend .env
```

### ABI Update
After deployment, copy ABI:
```bash
cp ../blockchain/artifacts/contracts/ShipmentTracking.sol/ShipmentTracking.json app/blockchain/abi.json
# Or extract just the ABI array from the artifact
```

---

## Project Structure

```
backend/
├── app/
│   ├── api/           # Route modules
│   ├── models/        # SQLAlchemy models
│   ├── schemas/       # Pydantic schemas
│   ├── services/      # Business logic
│   ├── blockchain/    # web3.py integration
│   ├── core/          # Config, security
│   ├── db/            # DB session, migrations
│   └── main.py        # FastAPI app
├── tests/             # Pytest tests
├── alembic/           # Migration scripts
├── requirements.txt
├── .env.example
└── alembic.ini
```

---

## Common Tasks

### Add New Endpoint
1. Add schema to `app/schemas/schemas.py`
2. Add service method to `app/services/services.py`
3. Add route to `app/api/routes.py`
4. Add test to `tests/test_backend.py`

### Modify Database Schema
1. Update model in `app/models/models.py`
2. Generate migration: `alembic revision --autogenerate -m "description"`
3. Review generated migration file
4. Apply: `alembic upgrade head`

### Add New Blockchain Function
1. Add to contract (blockchain dev)
2. Update ABI in `app/blockchain/abi.json`
3. Add method to `app/blockchain/client.py`
4. Add service method orchestrating DB + chain
4. Add API endpoint

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL async connection string |
| `JWT_SECRET` | Yes | — | Secret for signing JWTs (32+ chars) |
| `JWT_EXPIRY_MINUTES` | No | 30 | Access token lifetime |
| `JWT_REFRESH_EXPIRY_DAYS` | No | 7 | Refresh token lifetime |
| `BLOCKCHAIN_RPC_URL` | Yes | — | EVM RPC endpoint |
| `CONTRACT_ADDRESS` | Yes | — | Deployed contract address |
| `BACKEND_WALLET_PRIVATE_KEY` | Yes | — | 0x-prefixed private key |
| `CORS_ALLOWED_ORIGIN` | No | `http://localhost:3000` | Frontend origin |

---

## Debugging Tips

### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### View SQL Queries
Set `echo=True` in `app/db/session.py` engine creation.

### Check Contract Interaction
```bash
# In Python shell
from app.blockchain.client import blockchain_client
print(blockchain_client.is_connected())
print(blockchain_client.contract.address)
```

### Reset Database (Dev Only)
```bash
dropdb chainroute && createdb chainroute
alembic upgrade head
```

---

## Code Quality

### Linting (if configured)
```bash
ruff check .
ruff format .
```

### Type Checking (if configured)
```bash
mypy app/
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError` | Activate venv, `pip install -r requirements.txt` |
| `alembic: command not found` | `pip install alembic` |
| `DATABASE_URL` errors | Check PostgreSQL running, credentials correct |
| `web3` connection failed | Check `BLOCKCHAIN_RPC_URL`, network reachable |
| Contract call reverts | Check ABI matches deployed contract, wallet has funds |
| Tests fail | Ensure test DB exists, run `alembic upgrade head` on test DB |

---

## Useful Commands

```bash
# View API docs
open http://localhost:8000/docs

# Interactive DB shell
psql $DATABASE_URL

# Check migration status
alembic current

# Generate requirements from current env
pip freeze > requirements.txt
```