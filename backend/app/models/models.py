import enum
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, Enum, Index, BigInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.session import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    TRANSPORTER = "transporter"
    WAREHOUSE_OPERATOR = "warehouse_operator"
    DISTRIBUTOR = "distributor"
    RECEIVER = "receiver"
    VIEWER = "viewer"


class ShipmentStatus(str, enum.Enum):
    CREATED = "CREATED"
    ASSIGNED = "ASSIGNED"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    AT_WAREHOUSE = "AT_WAREHOUSE"
    CUSTODY_TRANSFERRED = "CUSTODY_TRANSFERRED"
    DELIVERED = "DELIVERED"


class EventType(str, enum.Enum):
    CREATED = "CREATED"
    ASSIGNED = "ASSIGNED"
    PICKED_UP = "PICKED_UP"
    CHECKPOINT = "CHECKPOINT"
    CUSTODY_TRANSFER = "CUSTODY_TRANSFER"
    DELIVERED = "DELIVERED"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    wallet_address = Column(String(42), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    vehicles = relationship("Vehicle", back_populates="transporter")
    shipments_as_manufacturer = relationship("Shipment", foreign_keys="Shipment.manufacturer_id", back_populates="manufacturer")
    shipments_as_transporter = relationship("Shipment", foreign_keys="Shipment.current_transporter_id", back_populates="current_transporter")
    shipments_as_custodian = relationship("Shipment", foreign_keys="Shipment.current_custodian_id", back_populates="current_custodian")
    checkpoints = relationship("Checkpoint", back_populates="recorded_by")
    custody_transfers_from = relationship("CustodyTransfer", foreign_keys="CustodyTransfer.from_user_id", back_populates="from_user")
    custody_transfers_to = relationship("CustodyTransfer", foreign_keys="CustodyTransfer.to_user_id", back_populates="to_user")
    shipment_events = relationship("ShipmentEvent", back_populates="actor")


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plate_number = Column(String(50), nullable=False, unique=True)
    type = Column(String(100), nullable=False)
    transporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    transporter = relationship("User", back_populates="vehicles")
    shipments = relationship("Shipment", back_populates="vehicle")


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chain_shipment_ref = Column(BigInteger, nullable=False, unique=True, index=True)
    manufacturer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    origin = Column(Text, nullable=False)
    destination = Column(Text, nullable=False)
    cargo_description = Column(Text, nullable=False)
    quantity = Column(Integer, nullable=False)
    current_transporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    current_custodian_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    vehicle_id = Column(UUID(as_uuid=True), ForeignKey("vehicles.id"), nullable=True)
    status = Column(Enum(ShipmentStatus), nullable=False, default=ShipmentStatus.CREATED, index=True)
    qr_code_value = Column(String(255), nullable=False, unique=True)
    creation_tx_hash = Column(String(66), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    manufacturer = relationship("User", foreign_keys=[manufacturer_id], back_populates="shipments_as_manufacturer")
    current_transporter = relationship("User", foreign_keys=[current_transporter_id], back_populates="shipments_as_transporter")
    current_custodian = relationship("User", foreign_keys=[current_custodian_id], back_populates="shipments_as_custodian")
    vehicle = relationship("Vehicle", back_populates="shipments")
    checkpoints = relationship("Checkpoint", back_populates="shipment", cascade="all, delete-orphan")
    custody_transfers = relationship("CustodyTransfer", back_populates="shipment", cascade="all, delete-orphan")
    events = relationship("ShipmentEvent", back_populates="shipment", cascade="all, delete-orphan")


class Checkpoint(Base):
    __tablename__ = "checkpoints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.id"), nullable=False, index=True)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    location = Column(Text, nullable=False)
    note = Column(Text, nullable=True)
    tx_hash = Column(String(66), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    shipment = relationship("Shipment", back_populates="checkpoints")
    recorded_by_user = relationship("User", back_populates="checkpoints")


class CustodyTransfer(Base):
    __tablename__ = "custody_transfers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.id"), nullable=False, index=True)
    from_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    to_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tx_hash = Column(String(66), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    shipment = relationship("Shipment", back_populates="custody_transfers")
    from_user = relationship("User", foreign_keys=[from_user_id], back_populates="custody_transfers_from")
    to_user = relationship("User", foreign_keys=[to_user_id], back_populates="custody_transfers_to")


class ShipmentEvent(Base):
    __tablename__ = "shipment_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.id"), nullable=False, index=True)
    event_type = Column(Enum(EventType), nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tx_hash = Column(String(66), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    shipment = relationship("Shipment", back_populates="events")
    actor = relationship("User", back_populates="shipment_events")


Index("ix_shipments_status", Shipment.status)
Index("ix_shipments_chain_shipment_ref", Shipment.chain_shipment_ref)
Index("ix_shipment_events_shipment_id", ShipmentEvent.shipment_id)
Index("ix_checkpoints_shipment_id", Checkpoint.shipment_id)
Index("ix_custody_transfers_shipment_id", CustodyTransfer.shipment_id)