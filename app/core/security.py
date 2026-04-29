from datetime import datetime, timedelta, timezone
from typing import Optional, Union, Any
from jose import jwt
import bcrypt
import secrets
from app.core.config import settings

class SecurityUtils:
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        if not plain_password or not hashed_password:
            return False
        return bcrypt.checkpw(
            plain_password.encode('utf-8'), 
            hashed_password.encode('utf-8')
        )

    @staticmethod
    def get_password_hash(password: str) -> str:
        pwd_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(pwd_bytes, salt)
        return hashed.decode('utf-8')

    @staticmethod
    def create_access_token(subject: Union[str, Any], role: Optional[str] = None, expires_delta: Optional[timedelta] = None) -> str:
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode = {"exp": expire, "sub": str(subject)}
        if role:
            to_encode["role"] = str(role)
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt

    @staticmethod
    def create_refresh_token() -> str:
        """Generate a cryptographically secure opaque refresh token."""
        return secrets.token_urlsafe(48)

    @staticmethod
    def create_password_reset_token() -> str:
        """Generate a cryptographically secure opaque password reset token.

        The raw value is returned to the caller (so it can be emailed) but the
        database only ever sees its hash — see `hash_password_reset_token`.
        """
        return secrets.token_urlsafe(48)

    @staticmethod
    def hash_password_reset_token(token: str) -> str:
        """Hash a password-reset token before storing it.

        Uses bcrypt for parity with stored passwords; this prevents a leaked
        database from yielding usable reset tokens.
        """
        return bcrypt.hashpw(token.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    @staticmethod
    def verify_password_reset_token(token: str, hashed_token: str) -> bool:
        """Constant-time-ish comparison against the stored bcrypt hash."""
        if not token or not hashed_token:
            return False
        try:
            return bcrypt.checkpw(token.encode("utf-8"), hashed_token.encode("utf-8"))
        except ValueError:
            return False


security = SecurityUtils()


# How long a password reset token remains valid. Hardcoded to 15 minutes per
# the security audit; bumping this requires a fresh review of the threat model.
PASSWORD_RESET_TOKEN_TTL_MINUTES = 15
