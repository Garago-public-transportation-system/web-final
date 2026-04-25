from datetime import timedelta, datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import logging
from app.core.database import get_db
from app.core.security import security
from app.core.config import settings
from app.models.models import User, UserRole
from app.schemas.schemas import UserResponse, Token, RefreshRequest, SignupRequest, PasswordChangeRequest, UserProfileUpdate
from app.api.deps import get_current_active_user, get_current_user_with_role
from app.services.audit_service import log_action

# M8: Import rate limiter from main app
from app.core.rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory refresh token store: token -> (email, expiry)
_refresh_tokens: dict[str, tuple[str, datetime]] = {}


def _purge_expired_refresh_tokens():
    """Remove expired tokens to prevent unbounded dict growth."""
    now = datetime.now(timezone.utc)
    expired = [k for k, (_, exp) in _refresh_tokens.items() if exp <= now]
    for k in expired:
        del _refresh_tokens[k]


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login(request: Request, form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: Annotated[AsyncSession, Depends(get_db)]):
    stmt = select(User).where(User.email == form_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    # Access token (60 min)
    access_token = security.create_access_token(
        subject=user.email,
        role=user.role.value if hasattr(user.role, 'value') else str(user.role),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    # Refresh token (7 days) — stored in memory
    refresh_token = security.create_refresh_token()
    expiry = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    _purge_expired_refresh_tokens()
    _refresh_tokens[refresh_token] = (user.email, expiry)

    # Audit login with IP
    ip = request.client.host if request.client else None
    await log_action(db, user.id, "LOGIN", "User", user.id, ip_address=ip)
    await db.commit()

    return Token(access_token=access_token, token_type="bearer", refresh_token=refresh_token)


@router.post("/refresh", response_model=Token)
async def refresh_access_token(body: RefreshRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    """Exchange a valid refresh token for a new access token."""
    entry = _refresh_tokens.get(body.refresh_token)
    if not entry:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    email, expiry = entry
    if datetime.now(timezone.utc) > expiry:
        del _refresh_tokens[body.refresh_token]
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    stmt = select(User).where(User.email == email, User.is_active == True)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    access_token = security.create_access_token(
        subject=user.email,
        role=user.role.value if hasattr(user.role, 'value') else str(user.role),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return Token(access_token=access_token, token_type="bearer")


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    request: Request,
    body: SignupRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))
):
    """Admin-only: create a new user with a specified role."""
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=security.get_password_hash(body.password),
        role=body.role,
        phone=body.phone,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    ip = request.client.host if request.client else None
    await log_action(db, current_user.id, "SIGNUP", "User", new_user.id, ip_address=ip)
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: Annotated[User, Depends(get_current_active_user)]):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    body: UserProfileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
):
    """Any authenticated user can update their own name, phone, and language preference."""
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(current_user, key, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    request: Request,
    body: PasswordChangeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_active_user),
):
    """Validate current password then hash and store the new one."""
    if not security.verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    current_user.hashed_password = security.get_password_hash(body.new_password)
    await db.commit()

    ip = request.client.host if request.client else None
    await log_action(db, current_user.id, "CHANGE_PASSWORD", "User", current_user.id, ip_address=ip)
    await db.commit()
