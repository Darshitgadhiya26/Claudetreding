from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timezone
from typing import Optional
import logging

from app.database import get_db
from app.models.user import User
from app.utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    validate_password_strength,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Schemas ────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    full_name: str
    is_admin: bool


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    is_active: bool
    is_admin: bool
    is_verified: bool
    preferences: Optional[dict]
    broker_credentials: Optional[dict]
    telegram_chat_id: Optional[str]
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    preferences: Optional[dict] = None
    telegram_chat_id: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Validate password strength
    if not validate_password_strength(payload.password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters with uppercase, lowercase and digit",
        )

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        is_active=True,
        is_admin=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    logger.info(f"New user registered: {user.email}")

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_admin=user.is_admin,
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return JWT tokens."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user: Optional[User] = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Contact support.",
        )

    # Update last login
    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    logger.info(f"User logged in: {user.email}")

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_admin=user.is_admin,
    )


@router.post("/refresh-token", response_model=TokenResponse)
async def refresh_token(payload: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Issue new access token using a valid refresh token."""
    token_data = decode_token(payload.refresh_token)

    if token_data.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = token_data.get("sub")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user: Optional[User] = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    access_token = create_access_token({"sub": str(user.id)})
    new_refresh_token = create_refresh_token({"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_admin=user.is_admin,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user profile fields."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.phone is not None:
        current_user.phone = payload.phone
    if payload.telegram_chat_id is not None:
        current_user.telegram_chat_id = payload.telegram_chat_id
    if payload.preferences is not None:
        # Merge preferences
        existing = current_user.preferences or {}
        existing.update(payload.preferences)
        current_user.preferences = existing

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Change the authenticated user's password."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if not validate_password_strength(payload.new_password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password must be at least 8 chars with uppercase, lowercase, digit",
        )

    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()

    return {"message": "Password changed successfully"}


@router.post("/broker-credentials")
async def update_broker_credentials(
    broker: str,
    credentials: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Save broker API credentials (stored in JSON field).
    In production, encrypt these with a KMS key.
    """
    existing = current_user.broker_credentials or {}
    existing[broker] = credentials
    current_user.broker_credentials = existing
    await db.commit()
    return {"message": f"{broker} credentials saved", "brokers": list(existing.keys())}


@router.delete("/broker-credentials/{broker}")
async def remove_broker_credentials(
    broker: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove stored credentials for a broker."""
    creds = current_user.broker_credentials or {}
    creds.pop(broker, None)
    current_user.broker_credentials = creds
    await db.commit()
    return {"message": f"{broker} credentials removed"}
