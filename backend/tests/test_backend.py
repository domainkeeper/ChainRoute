import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import uuid
from unittest.mock import AsyncMock, patch, MagicMock

from app.main import app
from app.db.session import Base, get_db
from app.models.models import User, Vehicle, Shipment, Checkpoint, CustodyTransfer, ShipmentEvent, UserRole, ShipmentStatus, EventType
from app.core.security import get_password_hash, create_access_token
from app.blockchain.client import blockchain_client

TEST_DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/chainroute_test"

engine_test = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = sessionmaker(engine_test, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
async def setup_database():
    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine_test.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session():
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


@pytest.fixture
def admin_user(db_session):
    user = User(
        name="Admin User",
        email="admin@test.com",
        password_hash=get_password_hash("password123"),
        role=UserRole.ADMIN,
        wallet_address="0x1234567890123456789012345678901234567890"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def transporter_user(db_session):
    user = User(
        name="Transporter User",
        email="transporter@test.com",
        password_hash=get_password_hash("password123"),
        role=UserRole.TRANSPORTER,
        wallet_address="0x2345678901234567890123456789012345678901"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def warehouse_user(db_session):
    user = User(
        name="Warehouse User",
        email="warehouse@test.com",
        password_hash=get_password_hash("password123"),
        role=UserRole.WAREHOUSE_OPERATOR,
        wallet_address="0x3456789012345678901234567890123456789012"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def receiver_user(db_session):
    user = User(
        name="Receiver User",
        email="receiver@test.com",
        password_hash=get_password_hash("password123"),
        role=UserRole.RECEIVER,
        wallet_address="0x4567890123456789012345678901234567890123"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_token(admin_user):
    return create_access_token({"sub": str(admin_user.id), "email": admin_user.email, "role": admin_user.role.value})


@pytest.fixture
def transporter_token(transporter_user):
    return create_access_token({"sub": str(transporter_user.id), "email": transporter_user.email, "role": transporter_user.role.value})


@pytest.fixture
def warehouse_token(warehouse_user):
    return create_access_token({"sub": str(warehouse_user.id), "email": warehouse_user.email, "role": warehouse_user.role.value})


@pytest.fixture
def receiver_token(receiver_user):
    return create_access_token({"sub": str(receiver_user.id), "email": receiver_user.email, "role": receiver_user.role.value})


@pytest.fixture
def auth_headers_admin(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def auth_headers_transporter(transporter_token):
    return {"Authorization": f"Bearer {transporter_token}"}


@pytest.fixture
def auth_headers_warehouse(warehouse_token):
    return {"Authorization": f"Bearer {warehouse_token}"}


@pytest.fixture
def auth_headers_receiver(receiver_token):
    return {"Authorization": f"Bearer {receiver_token}"}


@pytest.fixture
def vehicle(db_session, transporter_user):
    v = Vehicle(
        plate_number="ABC123",
        type="Truck",
        transporter_id=transporter_user.id
    )
    db_session.add(v)
    db_session.commit()
    db_session.refresh(v)
    return v


@pytest.fixture
def mock_blockchain_success():
    with patch('app.services.services.blockchain_client') as mock:
        mock.create_shipment = AsyncMock(return_value={
            "success": True,
            "tx_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            "receipt": MagicMock(blockNumber=12345)
        })
        mock.assign_transporter = AsyncMock(return_value={
            "success": True,
            "tx_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567891",
            "receipt": MagicMock(blockNumber=12346)
        })
        mock.record_pickup = AsyncMock(return_value={
            "success": True,
            "tx_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567892",
            "receipt": MagicMock(blockNumber=12347)
        })
        mock.record_checkpoint = AsyncMock(return_value={
            "success": True,
            "tx_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567893",
            "receipt": MagicMock(blockNumber=12348)
        })
        mock.transfer_custody = AsyncMock(return_value={
            "success": True,
            "tx_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567894",
            "receipt": MagicMock(blockNumber=12349)
        })
        mock.mark_delivered = AsyncMock(return_value={
            "success": True,
            "tx_hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567895",
            "receipt": MagicMock(blockNumber=12350)
        })
        mock.get_shipment_events = AsyncMock(return_value=[])
        yield mock


class TestAuth:
    @pytest.mark.asyncio
    async def test_login_success(self, admin_user):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post("/api/v1/auth/login", json={
                "email": "admin@test.com",
                "password": "password123"
            })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "admin@test.com"

    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post("/api/v1/auth/login", json={
                "email": "admin@test.com",
                "password": "wrongpassword"
            })
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHORIZED"

    @pytest.mark.asyncio
    async def test_refresh_token(self, admin_token):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post("/api/v1/auth/refresh", json={
                "refresh_token": admin_token
            })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data


class TestShipments:
    @pytest.mark.asyncio
    async def test_create_shipment_success(self, auth_headers_admin, mock_blockchain_success):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post("/api/v1/shipments", json={
                "origin": "Shanghai, China",
                "destination": "Los Angeles, USA",
                "cargo_description": "Electronics",
                "quantity": 100
            }, headers=auth_headers_admin)
        assert response.status_code == 201
        data = response.json()
        assert "shipment" in data
        assert "tx_hash" in data
        assert "block_number" in data
        assert data["shipment"]["status"] == "CREATED"

    @pytest.mark.asyncio
    async def test_create_shipment_unauthorized(self, auth_headers_transporter):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post("/api/v1/shipments", json={
                "origin": "Shanghai",
                "destination": "LA",
                "cargo_description": "Electronics",
                "quantity": 100
            }, headers=auth_headers_transporter)
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "FORBIDDEN_ROLE"

    @pytest.mark.asyncio
    async def test_assign_transporter_success(self, auth_headers_admin, transporter_user, vehicle, mock_blockchain_success):
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_resp = await client.post("/api/v1/shipments", json={
                "origin": "Shanghai",
                "destination": "LA",
                "cargo_description": "Electronics",
                "quantity": 100
            }, headers=auth_headers_admin)
        shipment_id = create_resp.json()["shipment"]["id"]

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(f"/api/v1/shipments/{shipment_id}/assign", json={
                "transporter_id": str(transporter_user.id),
                "vehicle_id": str(vehicle.id)
            }, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["shipment"]["status"] == "ASSIGNED"
        assert data["shipment"]["current_transporter_id"] == str(transporter_user.id)

    @pytest.mark.asyncio
    async def test_assign_transporter_invalid_state(self, auth_headers_admin, transporter_user, vehicle, mock_blockchain_success):
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_resp = await client.post("/api/v1/shipments", json={
                "origin": "Shanghai",
                "destination": "LA",
                "cargo_description": "Electronics",
                "quantity": 100
            }, headers=auth_headers_admin)
        shipment_id = create_resp.json()["shipment"]["id"]

        async with AsyncClient(app=app, base_url="http://test") as client:
            await client.post(f"/api/v1/shipments/{shipment_id}/assign", json={
                "transporter_id": str(transporter_user.id),
                "vehicle_id": str(vehicle.id)
            }, headers=auth_headers_admin)
            response = await client.post(f"/api/v1/shipments/{shipment_id}/assign", json={
                "transporter_id": str(transporter_user.id)
            }, headers=auth_headers_admin)
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "INVALID_STATE_TRANSITION"

    @pytest.mark.asyncio
    async def test_pickup_success(self, auth_headers_admin, auth_headers_transporter, transporter_user, vehicle, mock_blockchain_success):
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_resp = await client.post("/api/v1/shipments", json={
                "origin": "Shanghai",
                "destination": "LA",
                "cargo_description": "Electronics",
                "quantity": 100
            }, headers=auth_headers_admin)
        shipment_id = create_resp.json()["shipment"]["id"]

        async with AsyncClient(app=app, base_url="http://test") as client:
            await client.post(f"/api/v1/shipments/{shipment_id}/assign", json={
                "transporter_id": str(transporter_user.id),
                "vehicle_id": str(vehicle.id)
            }, headers=auth_headers_admin)

            response = await client.post(f"/api/v1/shipments/{shipment_id}/pickup", headers=auth_headers_transporter)
        assert response.status_code == 200
        data = response.json()
        assert data["shipment"]["status"] == "PICKED_UP"
        assert data["shipment"]["current_custodian_id"] == str(transporter_user.id)

    @pytest.mark.asyncio
    async def test_pickup_wrong_transporter(self, auth_headers_admin, transporter_user, vehicle, mock_blockchain_success):
        other_transporter = User(
            name="Other Transporter",
            email="other@test.com",
            password_hash=get_password_hash("password123"),
            role=UserRole.TRANSPORTER,
            wallet_address="0x5678901234567890123456789012345678901234"
        )
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_resp = await client.post("/api/v1/shipments", json={
                "origin": "Shanghai",
                "destination": "LA",
                "cargo_description": "Electronics",
                "quantity": 100
            }, headers=auth_headers_admin)
        shipment_id = create_resp.json()["shipment"]["id"]

        async with AsyncClient(app=app, base_url="http://test") as client:
            await client.post(f"/api/v1/shipments/{shipment_id}/assign", json={
                "transporter_id": str(transporter_user.id),
                "vehicle_id": str(vehicle.id)
            }, headers=auth_headers_admin)

            other_token = create_access_token({"sub": str(other_transporter.id), "email": other_transporter.email, "role": other_transporter.role.value})
            response = await client.post(f"/api/v1/shipments/{shipment_id}/pickup", headers={"Authorization": f"Bearer {other_token}"})
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "FORBIDDEN_ROLE"

    @pytest.mark.asyncio
    async def test_checkpoint_success(self, auth_headers_admin, auth_headers_transporter, transporter_user, vehicle, mock_blockchain_success):
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_resp = await client.post("/api/v1/shipments", json={
                "origin": "Shanghai",
                "destination": "LA",
                "cargo_description": "Electronics",
                "quantity": 100
            }, headers=auth_headers_admin)
        shipment_id = create_resp.json()["shipment"]["id"]

        async with AsyncClient(app=app, base_url="http://test") as client:
            await client.post(f"/api/v1/shipments/{shipment_id}/assign", json={
                "transporter_id": str(transporter_user.id),
                "vehicle_id": str(vehicle.id)
            }, headers=auth_headers_admin)
            await client.post(f"/api/v1/shipments/{shipment_id}/pickup", headers=auth_headers_transporter)

            response = await client.post(f"/api/v1/shipments/{shipment_id}/checkpoint", json={
                "location": "Port of Shanghai",
                "note": "Loaded onto vessel"
            }, headers=auth_headers_transporter)
        assert response.status_code == 200
        data = response.json()
        assert data["shipment"]["status"] == "IN_TRANSIT"

    @pytest.mark.asyncio
    async def test_handoff_success(self, auth_headers_admin, auth_headers_transporter, transporter_user, warehouse_user, vehicle, mock_blockchain_success):
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_resp = await client.post("/api/v1/shipments", json={
                "origin": "Shanghai",
                "destination": "LA",
                "cargo_description": "Electronics",
                "quantity": 100
            }, headers=auth_headers_admin)
        shipment_id = create_resp.json()["shipment"]["id"]

        async with AsyncClient(app=app, base_url="http://test") as client:
            await client.post(f"/api/v1/shipments/{shipment_id}/assign", json={
                "transporter_id": str(transporter_user.id),
                "vehicle_id": str(vehicle.id)
            }, headers=auth_headers_admin)
            await client.post(f"/api/v1/shipments/{shipment_id}/pickup", headers=auth_headers_transporter)

            response = await client.post(f"/api/v1/shipments/{shipment_id}/handoff", json={
                "to_user_id": str(warehouse_user.id)
            }, headers=auth_headers_transporter)
        assert response.status_code == 200
        data = response.json()
        assert data["shipment"]["status"] == "CUSTODY_TRANSFERRED"
        assert data["shipment"]["current_custodian_id"] == str(warehouse_user.id)

    @pytest.mark.asyncio
    async def test_deliver_success(self, auth_headers_admin, auth_headers_transporter, auth_headers_warehouse, auth_headers_receiver, transporter_user, warehouse_user, receiver_user, vehicle, mock_blockchain_success):
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_resp = await client.post("/api/v1/shipments", json={
                "origin": "Shanghai",
                "destination": "LA",
                "cargo_description": "Electronics",
                "quantity": 100
            }, headers=auth_headers_admin)
        shipment_id = create_resp.json()["shipment"]["id"]

        async with AsyncClient(app=app, base_url="http://test") as client:
            await client.post(f"/api/v1/shipments/{shipment_id}/assign", json={
                "transporter_id": str(transporter_user.id),
                "vehicle_id": str(vehicle.id)
            }, headers=auth_headers_admin)
            await client.post(f"/api/v1/shipments/{shipment_id}/pickup", headers=auth_headers_transporter)
            await client.post(f"/api/v1/shipments/{shipment_id}/handoff", json={
                "to_user_id": str(warehouse_user.id)
            }, headers=auth_headers_transporter)
            await client.post(f"/api/v1/shipments/{shipment_id}/handoff", json={
                "to_user_id": str(receiver_user.id)
            }, headers=auth_headers_warehouse)

            response = await client.post(f"/api/v1/shipments/{shipment_id}/deliver", headers=auth_headers_receiver)
        assert response.status_code == 200
        data = response.json()
        assert data["shipment"]["status"] == "DELIVERED"

    @pytest.mark.asyncio
    async def test_deliver_wrong_role(self, auth_headers_admin, auth_headers_transporter, transporter_user, warehouse_user, vehicle, mock_blockchain_success):
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_resp = await client.post("/api/v1/shipments", json={
                "origin": "Shanghai",
                "destination": "LA",
                "cargo_description": "Electronics",
                "quantity": 100
            }, headers=auth_headers_admin)
        shipment_id = create_resp.json()["shipment"]["id"]

        async with AsyncClient(app=app, base_url="http://test") as client:
            await client.post(f"/api/v1/shipments/{shipment_id}/assign", json={
                "transporter_id": str(transporter_user.id),
                "vehicle_id": str(vehicle.id)
            }, headers=auth_headers_admin)
            await client.post(f"/api/v1/shipments/{shipment_id}/pickup", headers=auth_headers_transporter)
            await client.post(f"/api/v1/shipments/{shipment_id}/handoff", json={
                "to_user_id": str(warehouse_user.id)
            }, headers=auth_headers_transporter)

            response = await client.post(f"/api/v1/shipments/{shipment_id}/deliver", headers=auth_headers_warehouse)
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "FORBIDDEN_ROLE"

    @pytest.mark.asyncio
    async def test_get_shipment(self, auth_headers_admin, mock_blockchain_success):
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_resp = await client.post("/api/v1/shipments", json={
                "origin": "Shanghai",
                "destination": "LA",
                "cargo_description": "Electronics",
                "quantity": 100
            }, headers=auth_headers_admin)
        shipment_id = create_resp.json()["shipment"]["id"]

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(f"/api/v1/shipments/{shipment_id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == shipment_id

    @pytest.mark.asyncio
    async def test_get_shipment_not_found(self, auth_headers_admin):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(f"/api/v1/shipments/{uuid.uuid4()}", headers=auth_headers_admin)
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "NOT_FOUND"

    @pytest.mark.asyncio
    async def test_get_shipment_by_qr_public(self, mock_blockchain_success):
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_resp = await client.post("/api/v1/shipments", json={
                "origin": "Shanghai",
                "destination": "LA",
                "cargo_description": "Electronics",
                "quantity": 100
            }, headers={"Authorization": f"Bearer {create_access_token({'sub': str(uuid.uuid4()), 'email': 'admin@test.com', 'role': 'admin'})}"})
        shipment = create_resp.json()["shipment"]
        qr_value = shipment["qr_code_value"]

        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(f"/api/v1/shipments/qr/{qr_value}")
        assert response.status_code == 200
        data = response.json()
        assert data["qr_code_value"] == qr_value

    @pytest.mark.asyncio
    async def test_list_shipments(self, auth_headers_admin, mock_blockchain_success):
        async with AsyncClient(app=app, base_url="http://test") as client:
            for i in range(3):
                await client.post("/api/v1/shipments", json={
                    "origin": f"Origin {i}",
                    "destination": f"Dest {i}",
                    "cargo_description": f"Cargo {i}",
                    "quantity": 100 + i
                }, headers=auth_headers_admin)

            response = await client.get("/api/v1/shipments", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data["shipments"]) == 3
        assert data["total"] == 3

    @pytest.mark.asyncio
    async def test_history_endpoint(self, auth_headers_admin, auth_headers_transporter, transporter_user, vehicle, mock_blockchain_success):
        async with AsyncClient(app=app, base_url="http://test") as client:
            create_resp = await client.post("/api/v1/shipments", json={
                "origin": "Shanghai",
                "destination": "LA",
                "cargo_description": "Electronics",
                "quantity": 100
            }, headers=auth_headers_admin)
        shipment_id = create_resp.json()["shipment"]["id"]

        async with AsyncClient(app=app, base_url="http://test") as client:
            await client.post(f"/api/v1/shipments/{shipment_id}/assign", json={
                "transporter_id": str(transporter_user.id),
                "vehicle_id": str(vehicle.id)
            }, headers=auth_headers_admin)
            await client.post(f"/api/v1/shipments/{shipment_id}/pickup", headers=auth_headers_transporter)

            response = await client.get(f"/api/v1/shipments/{shipment_id}/history")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert "checkpoints" in data
        assert "custody_transfers" in data


class TestValidation:
    @pytest.mark.asyncio
    async def test_create_shipment_validation_error(self, auth_headers_admin):
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post("/api/v1/shipments", json={
                "origin": "Shanghai",
                "destination": "LA",
                "cargo_description": "Electronics"
            }, headers=auth_headers_admin)
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"


class TestModels:
    def test_user_model(self, db_session):
        user = User(
            name="Test User",
            email="test@test.com",
            password_hash=get_password_hash("password123"),
            role=UserRole.ADMIN
        )
        db_session.add(user)
        db_session.commit()
        assert user.id is not None

    def test_shipment_status_enum(self):
        assert ShipmentStatus.CREATED.value == "CREATED"
        assert ShipmentStatus.ASSIGNED.value == "ASSIGNED"
        assert ShipmentStatus.PICKED_UP.value == "PICKED_UP"
        assert ShipmentStatus.IN_TRANSIT.value == "IN_TRANSIT"
        assert ShipmentStatus.AT_WAREHOUSE.value == "AT_WAREHOUSE"
        assert ShipmentStatus.CUSTODY_TRANSFERRED.value == "CUSTODY_TRANSFERRED"
        assert ShipmentStatus.DELIVERED.value == "DELIVERED"