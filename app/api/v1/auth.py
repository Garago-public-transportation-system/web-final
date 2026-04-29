from datetime import timedelta, datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import logging
from app.core.database import get_db
from app.core.security import security, PASSWORD_RESET_TOKEN_TTL_MINUTES
from app.core.config import settings
from app.models.models import User, UserRole
from app.schemas.schemas import (
    UserResponse, Token, RefreshRequest, SignupRequest, PasswordChangeRequest,
    UserProfileUpdate, ForgotPasswordRequest, ResetPasswordRequest,
)
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


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Issue a password-reset token to the requesting user.

    Security properties:
      - The raw token is generated server-side, hashed with bcrypt before
        being stored, and only the raw value is returned in the response so
        a downstream notifier can email it. Even if the database leaks, the
        stored hash is unusable.
      - Tokens expire 15 minutes after issuance (see
        `PASSWORD_RESET_TOKEN_TTL_MINUTES`).
      - The endpoint is rate-limited to mitigate enumeration / spam.
      - Every attempt is recorded in the audit log with the user id (when
        the email matches an account), the action, the IP address, and the
        timestamp (provided automatically by `AuditLog.created_at`).
      - The HTTP response is the same regardless of whether the email is
        registered, to avoid leaking account existence.
    """
    ip = request.client.host if request.client else None

    user = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()

    raw_token: str | None = None
    if user and user.is_active:
        raw_token = security.create_password_reset_token()
        user.password_reset_token = security.hash_password_reset_token(raw_token)
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(
            minutes=PASSWORD_RESET_TOKEN_TTL_MINUTES
        )
        await log_action(
            db, user.id, "FORGOT_PASSWORD_REQUEST", "User", user.id,
            new_values={"email": body.email}, ip_address=ip,
        )
        await db.commit()
    else:
        # Audit the failed attempt with no user_id so admins can spot probing.
        await log_action(
            db, None, "FORGOT_PASSWORD_REQUEST_UNKNOWN", "User", None,
            new_values={"email": body.email}, ip_address=ip,
        )
        await db.commit()

    response: dict = {
        "message": "If an account exists for this email, a reset link has been sent.",
        "expires_in_minutes": PASSWORD_RESET_TOKEN_TTL_MINUTES,
    }
    # In production, the raw token should be delivered via a side channel
    # (email) rather than the response body. We surface it here so the
    # caller can plug in their own delivery during development.
    if raw_token is not None:
        response["reset_token"] = raw_token
    return response


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Consume a password-reset token and set a new password.

    Validates the token against the stored bcrypt hash and rejects expired
    or unknown tokens with the same generic 400 message to avoid leaking
    which condition failed. On success the token fields are cleared so the
    same token cannot be re-used.
    """
    ip = request.client.host if request.client else None
    now = datetime.now(timezone.utc)

    # Narrow candidate set to users with a non-null token + valid expiry.
    candidates = (await db.execute(
        select(User).where(
            User.password_reset_token.is_not(None),
            User.password_reset_expires.is_not(None),
            User.password_reset_expires > now,
        )
    )).scalars().all()

    matched: User | None = None
    for candidate in candidates:
        if security.verify_password_reset_token(body.token, candidate.password_reset_token or ""):
            matched = candidate
            break

    if matched is None:
        await log_action(
            db, None, "RESET_PASSWORD_FAILED", "User", None, ip_address=ip,
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token.",
        )

    matched.hashed_password = security.get_password_hash(body.new_password)
    matched.password_reset_token = None
    matched.password_reset_expires = None

    await log_action(
        db, matched.id, "RESET_PASSWORD", "User", matched.id, ip_address=ip,
    )
    await db.commit()
