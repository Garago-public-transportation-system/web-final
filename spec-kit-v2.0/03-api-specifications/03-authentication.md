# Strict JWT & Bcrypt Authorization
> **Cross-Reference**: See `PRD-v2.0.md` Section 5.1 & Security layer.

## Hash Selection Constraint
`passlib` is functionally broken on Python 3.13 due to internal API removals (`crypt`). We utilize explicit, raw `bcrypt` for extreme security stability.

```python
import bcrypt
from datetime import datetime, timedelta, timezone
from jose import jwt

SECRET_KEY = settings.SECRET_KEY # Must be 32+ char cryptographic random
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12) # Costs ~250ms per hash execution
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
```

## Role-Based Dependency Injection (RBAC)
FastAPI `Depends` validates tokens globally:
1. `get_current_user`: Base decrypt logic, parses User ID.
2. `get_current_active_user`: Validates `is_active == True`.
3. `get_admin_user`: Checks `role == 'ADMIN'`. Applied to all mutating fleet commands.\n