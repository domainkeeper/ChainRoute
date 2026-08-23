import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.models import (
    User, Vehicle, Shipment, Checkpoint, CustodyTransfer, ShipmentEvent,
    UserRole, ShipmentStatus, EventType
)
from app.schemas.schemas import (
    UserCreate, UserLogin, VehicleCreate, ShipmentCreate, ShipmentAssign,
    CheckpointCreate, CustodyTransferCreate
)
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.blockchain.client import blockchain_client


class AuthService:
    @staticmethod
    async def register_user(db: AsyncSession, user_data: UserCreate) -> User:
        existing = await db.execute(select(User).where(User.email == user_data.email))
        if existing.scalar_one_or_none():
            raise ValueError("Email already registered")
        user = User(
            name=user_data.name,
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            role=user_data.role,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    @staticmethod
    async def authenticate(db: AsyncSession, email: str, password: str) -> Optional[User]:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user or not verify_password(password, user.password_hash):
            return None
        return user

    @staticmethod
    def create_tokens(user: User) -> tuple[str, str]:
        data = {"sub": str(user.id), "email": user.email, "role": user.role.value}
        return create_access_token(data), create_refresh_token(data)

    @staticmethod
    def verify_token(token: str) -> Optional[dict]:
        return decode_token(token)

    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()


class VehicleService:
    @staticmethod
    async def create_vehicle(db: AsyncSession, transporter_id: uuid.UUID, vehicle_data: VehicleCreate) -> Vehicle:
        vehicle = Vehicle(
            plate_number=vehicle_data.plate_number,
            type=vehicle_data.type,
            transporter_id=transporter_id,
        )
        db.add(vehicle)
        await db.commit()
        await db.refresh(vehicle)
        return vehicle

    @staticmethod
    async def get_vehicles_by_transporter(db: AsyncSession, transporter_id: uuid.UUID) -> List[Vehicle]:
        result = await db.execute(select(Vehicle).where(Vehicle.transporter_id == transporter_id))
        return result.scalars().all()


class ShipmentService:
    @staticmethod
    async def create_shipment(
        db: AsyncSession,
        manufacturer_id: uuid.UUID,
        shipment_data: ShipmentCreate,
        chain_shipment_ref: int,
        qr_code_value: str
    ) -> tuple[Shipment, dict]:
        manufacturer = await db.execute(select(User).where(User.id == manufacturer_id))
        manufacturer = manufacturer.scalar_one_or_none()
        if not manufacturer or manufacturer.role != UserRole.ADMIN:
            raise ValueError("Only admin users can create shipments")

        shipment = Shipment(
            chain_shipment_ref=chain_shipment_ref,
            manufacturer_id=manufacturer_id,
            origin=shipment_data.origin,
            destination=shipment_data.destination,
            cargo_description=shipment_data.cargo_description,
            quantity=shipment_data.quantity,
            status=ShipmentStatus.CREATED,
            qr_code_value=qr_code_value,
        )
        db.add(shipment)
        await db.flush()

        chain_result = blockchain_client.create_shipment(chain_shipment_ref)
        if not chain_result.get("success"):
            await db.rollback()
            raise Exception(f"Chain transaction failed: {chain_result.get('error')}")

        receipt = chain_result["receipt"]
        shipment.creation_tx_hash = chain_result["tx_hash"]

        event = ShipmentEvent(
            shipment_id=shipment.id,
            event_type=EventType.CREATED,
            actor_id=manufacturer_id,
            tx_hash=chain_result["tx_hash"],
        )
        db.add(event)

        await db.commit()
        await db.refresh(shipment)
        return shipment, {"tx_hash": chain_result["tx_hash"], "block_number": receipt.blockNumber}

    @staticmethod
    async def assign_transporter(
        db: AsyncSession,
        shipment_id: uuid.UUID,
        assign_data: ShipmentAssign,
        admin_id: uuid.UUID
    ) -> tuple[Shipment, dict]:
        shipment = await db.execute(
            select(Shipment).where(Shipment.id == shipment_id).options(selectinload(Shipment.current_transporter))
        )
        shipment = shipment.scalar_one_or_none()
        if not shipment:
            raise ValueError("Shipment not found")

        if shipment.status != ShipmentStatus.CREATED:
            raise ValueError("INVALID_STATE_TRANSITION: Shipment must be in CREATED status")

        transporter = await db.execute(select(User).where(User.id == assign_data.transporter_id))
        transporter = transporter.scalar_one_or_none()
        if not transporter or transporter.role != UserRole.TRANSPORTER:
            raise ValueError("Invalid transporter")

        if assign_data.vehicle_id:
            vehicle = await db.execute(select(Vehicle).where(Vehicle.id == assign_data.vehicle_id))
            vehicle = vehicle.scalar_one_or_none()
            if not vehicle or vehicle.transporter_id != assign_data.transporter_id:
                raise ValueError("Invalid vehicle for transporter")

        if not transporter.wallet_address:
            raise ValueError("Transporter has no wallet address configured")

        chain_result = blockchain_client.assign_transporter(shipment.chain_shipment_ref, transporter.wallet_address)
        if not chain_result.get("success"):
            await db.rollback()
            raise Exception(f"Chain transaction failed: {chain_result.get('error')}")

        receipt = chain_result["receipt"]
        shipment.current_transporter_id = assign_data.transporter_id
        shipment.vehicle_id = assign_data.vehicle_id
        shipment.status = ShipmentStatus.ASSIGNED
        shipment.updated_at = datetime.now(timezone.utc)

        event = ShipmentEvent(
            shipment_id=shipment.id,
            event_type=EventType.ASSIGNED,
            actor_id=admin_id,
            tx_hash=chain_result["tx_hash"],
        )
        db.add(event)

        await db.commit()
        await db.refresh(shipment)
        return shipment, {"tx_hash": chain_result["tx_hash"], "block_number": receipt.blockNumber}

    @staticmethod
    async def record_pickup(
        db: AsyncSession,
        shipment_id: uuid.UUID,
        transporter_id: uuid.UUID
    ) -> tuple[Shipment, dict]:
        shipment = await db.execute(
            select(Shipment).where(Shipment.id == shipment_id).options(selectinload(Shipment.current_transporter))
        )
        shipment = shipment.scalar_one_or_none()
        if not shipment:
            raise ValueError("Shipment not found")

        if shipment.status != ShipmentStatus.ASSIGNED:
            raise ValueError("INVALID_STATE_TRANSITION: Shipment must be in ASSIGNED status")

        if shipment.current_transporter_id != transporter_id:
            raise ValueError("FORBIDDEN_ROLE: Only assigned transporter can record pickup")

        transporter = await db.execute(select(User).where(User.id == transporter_id))
        transporter = transporter.scalar_one_or_none()
        if not transporter or not transporter.wallet_address:
            raise ValueError("Transporter has no wallet address configured")

        chain_result = blockchain_client.record_pickup(shipment.chain_shipment_ref)
        if not chain_result.get("success"):
            await db.rollback()
            raise Exception(f"Chain transaction failed: {chain_result.get('error')}")

        receipt = chain_result["receipt"]
        shipment.current_custodian_id = transporter_id
        shipment.status = ShipmentStatus.PICKED_UP
        shipment.updated_at = datetime.now(timezone.utc)

        event = ShipmentEvent(
            shipment_id=shipment.id,
            event_type=EventType.PICKED_UP,
            actor_id=transporter_id,
            tx_hash=chain_result["tx_hash"],
        )
        db.add(event)

        await db.commit()
        await db.refresh(shipment)
        return shipment, {"tx_hash": chain_result["tx_hash"], "block_number": receipt.blockNumber}

    @staticmethod
    async def record_checkpoint(
        db: AsyncSession,
        shipment_id: uuid.UUID,
        checkpoint_data: CheckpointCreate,
        custodian_id: uuid.UUID
    ) -> tuple[Shipment, Checkpoint, dict]:
        shipment = await db.execute(
            select(Shipment).where(Shipment.id == shipment_id).options(selectinload(Shipment.current_custodian))
        )
        shipment = shipment.scalar_one_or_none()
        if not shipment:
            raise ValueError("Shipment not found")

        if shipment.current_custodian_id != custodian_id:
            raise ValueError("FORBIDDEN_ROLE: Only current custodian can record checkpoint")

        chain_result = blockchain_client.record_checkpoint(shipment.chain_shipment_ref)
        if not chain_result.get("success"):
            await db.rollback()
            raise Exception(f"Chain transaction failed: {chain_result.get('error')}")

        receipt = chain_result["receipt"]
        checkpoint = Checkpoint(
            shipment_id=shipment.id,
            recorded_by=custodian_id,
            location=checkpoint_data.location,
            note=checkpoint_data.note,
            tx_hash=chain_result["tx_hash"],
        )
        db.add(checkpoint)

        if shipment.status == ShipmentStatus.PICKED_UP:
            shipment.status = ShipmentStatus.IN_TRANSIT
        shipment.updated_at = datetime.now(timezone.utc)

        event = ShipmentEvent(
            shipment_id=shipment.id,
            event_type=EventType.CHECKPOINT,
            actor_id=custodian_id,
            tx_hash=chain_result["tx_hash"],
        )
        db.add(event)

        await db.commit()
        await db.refresh(shipment)
        await db.refresh(checkpoint)
        return shipment, checkpoint, {"tx_hash": chain_result["tx_hash"], "block_number": receipt.blockNumber}

    @staticmethod
    async def transfer_custody(
        db: AsyncSession,
        shipment_id: uuid.UUID,
        transfer_data: CustodyTransferCreate,
        from_custodian_id: uuid.UUID
    ) -> tuple[Shipment, CustodyTransfer, dict]:
        shipment = await db.execute(
            select(Shipment).where(Shipment.id == shipment_id).options(selectinload(Shipment.current_custodian))
        )
        shipment = shipment.scalar_one_or_none()
        if not shipment:
            raise ValueError("Shipment not found")

        if shipment.current_custodian_id != from_custodian_id:
            raise ValueError("FORBIDDEN_ROLE: Only current custodian can transfer custody")

        to_user = await db.execute(select(User).where(User.id == transfer_data.to_user_id))
        to_user = to_user.scalar_one_or_none()
        if not to_user or not to_user.wallet_address:
            raise ValueError("Target user not found or has no wallet address")

        chain_result = blockchain_client.transfer_custody(shipment.chain_shipment_ref, to_user.wallet_address)
        if not chain_result.get("success"):
            await db.rollback()
            raise Exception(f"Chain transaction failed: {chain_result.get('error')}")

        receipt = chain_result["receipt"]
        transfer = CustodyTransfer(
            shipment_id=shipment.id,
            from_user_id=from_custodian_id,
            to_user_id=transfer_data.to_user_id,
            tx_hash=chain_result["tx_hash"],
        )
        db.add(transfer)

        shipment.current_custodian_id = transfer_data.to_user_id
        shipment.status = ShipmentStatus.CUSTODY_TRANSFERRED
        shipment.updated_at = datetime.now(timezone.utc)

        event = ShipmentEvent(
            shipment_id=shipment.id,
            event_type=EventType.CUSTODY_TRANSFER,
            actor_id=from_custodian_id,
            tx_hash=chain_result["tx_hash"],
        )
        db.add(event)

        await db.commit()
        await db.refresh(shipment)
        await db.refresh(transfer)
        return shipment, transfer, {"tx_hash": chain_result["tx_hash"], "block_number": receipt.blockNumber}

    @staticmethod
    async def mark_delivered(
        db: AsyncSession,
        shipment_id: uuid.UUID,
        receiver_id: uuid.UUID
    ) -> tuple[Shipment, dict]:
        shipment = await db.execute(
            select(Shipment).where(Shipment.id == shipment_id).options(selectinload(Shipment.current_custodian))
        )
        shipment = shipment.scalar_one_or_none()
        if not shipment:
            raise ValueError("Shipment not found")

        if shipment.current_custodian_id != receiver_id:
            raise ValueError("FORBIDDEN_ROLE: Only current custodian can mark delivered")

        receiver = await db.execute(select(User).where(User.id == receiver_id))
        receiver = receiver.scalar_one_or_none()
        if not receiver or receiver.role != UserRole.RECEIVER:
            raise ValueError("FORBIDDEN_ROLE: Only receiver role can mark delivered")

        chain_result = blockchain_client.mark_delivered(shipment.chain_shipment_ref)
        if not chain_result.get("success"):
            await db.rollback()
            raise Exception(f"Chain transaction failed: {chain_result.get('error')}")

        receipt = chain_result["receipt"]
        shipment.status = ShipmentStatus.DELIVERED
        shipment.updated_at = datetime.now(timezone.utc)

        event = ShipmentEvent(
            shipment_id=shipment.id,
            event_type=EventType.DELIVERED,
            actor_id=receiver_id,
            tx_hash=chain_result["tx_hash"],
        )
        db.add(event)

        await db.commit()
        await db.refresh(shipment)
        return shipment, {"tx_hash": chain_result["tx_hash"], "block_number": receipt.blockNumber}

    @staticmethod
    async def get_shipment(db: AsyncSession, shipment_id: uuid.UUID) -> Optional[Shipment]:
        result = await db.execute(
            select(Shipment).where(Shipment.id == shipment_id).options(
                selectinload(Shipment.manufacturer),
                selectinload(Shipment.current_transporter),
                selectinload(Shipment.current_custodian),
                selectinload(Shipment.vehicle)
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_shipment_by_qr(db: AsyncSession, qr_value: str) -> Optional[Shipment]:
        result = await db.execute(
            select(Shipment).where(Shipment.qr_code_value == qr_value).options(
                selectinload(Shipment.manufacturer),
                selectinload(Shipment.current_transporter),
                selectinload(Shipment.current_custodian),
                selectinload(Shipment.vehicle)
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_shipments(
        db: AsyncSession,
        skip: int = 0,
        limit: int = 100,
        status: Optional[ShipmentStatus] = None
    ) -> tuple[List[Shipment], int]:
        query = select(Shipment).options(
            selectinload(Shipment.manufacturer),
            selectinload(Shipment.current_transporter),
            selectinload(Shipment.current_custodian),
            selectinload(Shipment.vehicle)
        )
        if status:
            query = query.where(Shipment.status == status)
        query = query.order_by(Shipment.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        shipments = result.scalars().all()

        count_query = select(func.count(Shipment.id))
        if status:
            count_query = count_query.where(Shipment.status == status)
        count_result = await db.execute(count_query)
        total = count_result.scalar()

        return list(shipments), total

    @staticmethod
    async def get_history(db: AsyncSession, shipment_id: uuid.UUID) -> dict:
        shipment = await ShipmentService.get_shipment(db, shipment_id)
        if not shipment:
            raise ValueError("Shipment not found")

        events_result = await db.execute(
            select(ShipmentEvent).where(ShipmentEvent.shipment_id == shipment_id).order_by(ShipmentEvent.created_at)
        )
        events = events_result.scalars().all()

        checkpoints_result = await db.execute(
            select(Checkpoint).where(Checkpoint.shipment_id == shipment_id).order_by(Checkpoint.created_at)
        )
        checkpoints = checkpoints_result.scalars().all()

        transfers_result = await db.execute(
            select(CustodyTransfer).where(CustodyTransfer.shipment_id == shipment_id).order_by(CustodyTransfer.created_at)
        )
        transfers = transfers_result.scalars().all()

        chain_events = blockchain_client.get_shipment_events(shipment.chain_shipment_ref)

        return {
            "events": events,
            "checkpoints": checkpoints,
            "custody_transfers": transfers,
            "chain_events": chain_events,
        }