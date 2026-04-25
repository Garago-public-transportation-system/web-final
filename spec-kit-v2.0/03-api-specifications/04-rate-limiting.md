# Enterprise SlowAPI Rate Limiting
> **Cross-Reference**: See `PRD-v2.0.md` Sub-section 5.1 (Rate limiting bounds).

## Implementation Rules
Limiters cannot use memory states; they MUST use `redis` backends to ensure consistency across Uvicorn workers.

## Stratified Access Tiers
* **Unauthenticated (Login/Register)**: `@limiter.limit("10/minute")` - Prevents brute force dictionary attacks on `POST /auth/login`.
* **Standard Driver API**: `@limiter.limit("100/minute")` - For check-ins and normal data fetch ops.
* **Hardware Webhooks (GPS & Engine)**: `@limiter.limit("300/minute")` - Required to accommodate 18+ buses pinging location parameters every 5-10 seconds.
* **Internal Admin Scrapes**: `@limiter.limit("600/minute")` - Safe zone for exhaustive dashboard analytics parsing.

## Code Blueprint
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Redis configuration required in production
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```\n