from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid
from app.db.session import get_db
from app.schemas.schemas import (
    UserCreate, UserLogin, UserResponse, TokenResponse, RefreshTokenRequest,
    VehicleCreate, VehicleResponse,
    ShipmentCreate, ShipmentAssign, CheckpointCreate, CustodyTransferCreate,
    ShipmentResponse, CheckpointResponse, CustodyTransferResponse,
    ShipmentHistoryResponse, WriteResponse, ErrorResponse, ShipmentListResponse
)
from app.services.services import AuthService, VehicleService, ShipmentService
from app.core.security import decode_token
from app.models.models import User, UserRole, ShipmentStatus

router = APIRouter()


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = None
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Missing or invalid authorization header"}}
        )
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid or expired token"}}
        )
    user_id = uuid.UUID(payload.get("sub"))
    user = await AuthService.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "User not found"}}
        )
    return user


async def get_current_user_optional(
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = None
) -> Optional[User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload:
        return None
    user_id = uuid.UUID(payload.get("sub"))
    return await AuthService.get_user_by_id(db, user_id)


def require_role(allowed_roles: list[UserRole]):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN_ROLE", "message": f"Required role: {[r.value for r in allowed_roles]}"}}
            )
        return current_user
    return role_checker


@router.post("/auth/login", response_model=TokenResponse)
async def login(login_data: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await AuthService.authenticate(db, login_data.email, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid credentials"}}
        )
    access_token, refresh_token = AuthService.create_tokens(user)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user)
    )


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token(refresh_data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(refresh_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "Invalid refresh token"}}
        )
    user_id = uuid.UUID(payload.get("sub"))
    user = await AuthService.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "UNAUTHORIZED", "message": "User not found"}}
        )
    access_token, new_refresh_token = AuthService.create_tokens(user)
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.model_validate(user)
    )


@router.post("/shipments", response_model=WriteResponse, status_code=status.HTTP_201_CREATED)
async def create_shipment(
    shipment_data: ShipmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    import hashlib
    chain_ref = int(hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest(), 16) % (10**18)
    qr_value = f"CR-{chain_ref}"

    try:
        shipment, chain_info = await ShipmentService.create_shipment(
            db, current_user.id, shipment_data, chain_ref, qr_value
        )
        return WriteResponse(
            shipment=ShipmentResponse.model_validate(shipment),
            tx_hash=chain_info["tx_hash"],
            block_number=chain_info["block_number"]
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "VALIDATION_ERROR", "message": str(e)}}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": {"code": "CHAIN_TX_FAILED", "message": str(e)}}
        )


@router.post("/shipments/{shipment_id}/assign", response_model=WriteResponse)
async def assign_transporter(
    shipment_id: uuid.UUID,
    assign_data: ShipmentAssign,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    try:
        shipment, chain_info = await ShipmentService.assign_transporter(db, shipment_id, assign_data, current_user.id)
        return WriteResponse(
            shipment=ShipmentResponse.model_validate(shipment),
            tx_hash=chain_info["tx_hash"],
            block_number=chain_info["block_number"]
        )
    except ValueError as e:
        if "INVALID_STATE_TRANSITION" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": {"code": "INVALID_STATE_TRANSITION", "message": str(e)}}
            )
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": {"code": "NOT_FOUND", "message": str(e)}}
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "VALIDATION_ERROR", "message": str(e)}}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": {"code": "CHAIN_TX_FAILED", "message": str(e)}}
        )


@router.post("/shipments/{shipment_id}/pickup", response_model=WriteResponse)
async def record_pickup(
    shipment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.TRANSPORTER]))
):
    try:
        shipment, chain_info = await ShipmentService.record_pickup(db, shipment_id, current_user.id)
        return WriteResponse(
            shipment=ShipmentResponse.model_validate(shipment),
            tx_hash=chain_info["tx_hash"],
            block_number=chain_info["block_number"]
        )
    except ValueError as e:
        if "INVALID_STATE_TRANSITION" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": {"code": "INVALID_STATE_TRANSITION", "message": str(e)}}
            )
        if "FORBIDDEN_ROLE" in str(e):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN_ROLE", "message": str(e)}}
            )
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": {"code": "NOT_FOUND", "message": str(e)}}
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "VALIDATION_ERROR", "message": str(e)}}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": {"code": "CHAIN_TX_FAILED", "message": str(e)}}
        )


@router.post("/shipments/{shipment_id}/checkpoint", response_model=WriteResponse)
async def record_checkpoint(
    shipment_id: uuid.UUID,
    checkpoint_data: CheckpointCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        shipment, checkpoint, chain_info = await ShipmentService.record_checkpoint(
            db, shipment_id, checkpoint_data, current_user.id
        )
        return WriteResponse(
            shipment=ShipmentResponse.model_validate(shipment),
            tx_hash=chain_info["tx_hash"],
            block_number=chain_info["block_number"]
        )
    except ValueError as e:
        if "FORBIDDEN_ROLE" in str(e):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN_ROLE", "message": str(e)}}
            )
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": {"code": "NOT_FOUND", "message": str(e)}}
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "VALIDATION_ERROR", "message": str(e)}}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": {"code": "CHAIN_TX_FAILED", "message": str(e)}}
        )


@router.post("/shipments/{shipment_id}/handoff", response_model=WriteResponse)
async def transfer_custody(
    shipment_id: uuid.UUID,
    transfer_data: CustodyTransferCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        shipment, transfer, chain_info = await ShipmentService.transfer_custody(
            db, shipment_id, transfer_data, current_user.id
        )
        return WriteResponse(
            shipment=ShipmentResponse.model_validate(shipment),
            tx_hash=chain_info["tx_hash"],
            block_number=chain_info["block_number"]
        )
    except ValueError as e:
        if "FORBIDDEN_ROLE" in str(e):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN_ROLE", "message": str(e)}}
            )
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": {"code": "NOT_FOUND", "message": str(e)}}
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "VALIDATION_ERROR", "message": str(e)}}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": {"code": "CHAIN_TX_FAILED", "message": str(e)}}
        )


@router.post("/shipments/{shipment_id}/deliver", response_model=WriteResponse)
async def mark_delivered(
    shipment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.RECEIVER]))
):
    try:
        shipment, chain_info = await ShipmentService.mark_delivered(db, shipment_id, current_user.id)
        return WriteResponse(
            shipment=ShipmentResponse.model_validate(shipment),
            tx_hash=chain_info["tx_hash"],
            block_number=chain_info["block_number"]
        )
    except ValueError as e:
        if "FORBIDDEN_ROLE" in str(e):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": {"code": "FORBIDDEN_ROLE", "message": str(e)}}
            )
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": {"code": "NOT_FOUND", "message": str(e)}}
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "VALIDATION_ERROR", "message": str(e)}}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": {"code": "CHAIN_TX_FAILED", "message": str(e)}}
        )


@router.get("/shipments/{shipment_id}", response_model=ShipmentResponse)
async def get_shipment(
    shipment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    shipment = await ShipmentService.get_shipment(db, shipment_id)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Shipment not found"}}
        )
    return ShipmentResponse.model_validate(shipment)


@router.get("/shipments/qr/{qr_value}", response_model=ShipmentResponse)
async def get_shipment_by_qr(
    qr_value: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    shipment = await ShipmentService.get_shipment_by_qr(db, qr_value)
    if not shipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Shipment not found"}}
        )
    return ShipmentResponse.model_validate(shipment)


@router.get("/shipments", response_model=ShipmentListResponse)
async def list_shipments(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[ShipmentStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    shipments, total = await ShipmentService.get_shipments(db, skip, limit, status_filter)
    return ShipmentListResponse(
        shipments=[ShipmentResponse.model_validate(s) for s in shipments],
        total=total
    )


@router.get("/shipments/{shipment_id}/history", response_model=ShipmentHistoryResponse)
async def get_shipment_history(
    shipment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    try:
        history = await ShipmentService.get_history(db, shipment_id)
        return ShipmentHistoryResponse(
            events=[e for e in history["events"]],
            checkpoints=[c for c in history["checkpoints"]],
            custody_transfers=[t for t in history["custody_transfers"]]
        )
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": {"code": "NOT_FOUND", "message": str(e)}}
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "VALIDATION_ERROR", "message": str(e)}}
        )