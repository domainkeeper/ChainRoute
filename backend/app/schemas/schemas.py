from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
import uuid
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    TRANSPORTER = "transporter"
    WAREHOUSE_OPERATOR = "warehouse_operator"
    DISTRIBUTOR = "distributor"
    RECEIVER = "receiver"
    VIEWER = "viewer"


class ShipmentStatus(str, Enum):
    CREATED = "CREATED"
    ASSIGNED = "ASSIGNED"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    AT_WAREHOUSE = "AT_WAREHOUSE"
    CUSTODY_TRANSFERRED = "CUSTODY_TRANSFERRED"
    DELIVERED = "DELIVERED"


class EventType(str, Enum):
    CREATED = "CREATED"
    ASSIGNED = "ASSIGNED"
    PICKED_UP = "PICKED_UP"
    CHECKPOINT = "CHECKPOINT"
    CUSTODY_TRANSFER = "CUSTODY_TRANSFER"
    DELIVERED = "DELIVERED"


class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: UserRole


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: uuid.UUID
    wallet_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class VehicleBase(BaseModel):
    plate_number: str
    type: str


class VehicleCreate(VehicleBase):
    pass


class VehicleResponse(VehicleBase):
    id: uuid.UUID
    transporter_id: uuid.UUID

    class Config:
        from_attributes = True


class ShipmentBase(BaseModel):
    origin: str
    destination: str
    cargo_description: str
    quantity: int = Field(..., gt=0)


class ShipmentCreate(ShipmentBase):
    pass


class ShipmentAssign(BaseModel):
    transporter_id: uuid.UUID
    vehicle_id: Optional[uuid.UUID] = None


class ShipmentPickup(BaseModel):
    pass


class CheckpointCreate(BaseModel):
    location: str
    note: Optional[str] = None


class CustodyTransferCreate(BaseModel):
    to_user_id: uuid.UUID


class ShipmentDeliver(BaseModel):
    pass


class ShipmentResponse(ShipmentBase):
    id: uuid.UUID
    chain_shipment_ref: int
    manufacturer_id: uuid.UUID
    current_transporter_id: Optional[uuid.UUID] = None
    current_custodian_id: Optional[uuid.UUID] = None
    vehicle_id: Optional[uuid.UUID] = None
    status: ShipmentStatus
    qr_code_value: str
    creation_tx_hash: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CheckpointResponse(BaseModel):
    id: uuid.UUID
    shipment_id: uuid.UUID
    recorded_by: uuid.UUID
    location: str
    note: Optional[str] = None
    tx_hash: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CustodyTransferResponse(BaseModel):
    id: uuid.UUID
    shipment_id: uuid.UUID
    from_user_id: uuid.UUID
    to_user_id: uuid.UUID
    tx_hash: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ShipmentEventResponse(BaseModel):
    id: uuid.UUID
    shipment_id: uuid.UUID
    event_type: EventType
    actor_id: uuid.UUID
    tx_hash: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ShipmentHistoryResponse(BaseModel):
    events: List[ShipmentEventResponse]
    checkpoints: List[CheckpointResponse]
    custody_transfers: List[CustodyTransferResponse]


class WriteResponse(BaseModel):
    shipment: ShipmentResponse
    tx_hash: str
    block_number: int


class ErrorResponse(BaseModel):
    error: dict


class ShipmentListResponse(BaseModel):
    shipments: List[ShipmentResponse]
    total: int