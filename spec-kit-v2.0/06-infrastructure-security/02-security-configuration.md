# API Security & Deep Sanitization
> **Cross-Reference**: See `PRD-v2.0.md` Technical Requirements (Bleach setup).

## XSS Extermination
Every text endpoint (Driver notes, Route Names, Ticket Hashes) parses through `bleach` middleware to strip executable components.
```python
import bleach
from fastapi import Request

async def sanitize_middleware(request: Request, call_next):
    # Only parse JSON bodies
    if "application/json" in request.headers.get("content-type", ""):
        body_bytes = await request.body()
        # Custom logic traverses JSON and applies bleach.clean(...) to all string leaves.
        # ... logic omitted for brevity
    return await call_next(request)
```
## Payload Regex Enforcement
License plates must conform: e.g., `^[أ-ي]{3}\s\d{3,4}$` (Three Arabic characters, space, 3-4 digits).
Any violation returns HTTP 422 Unprocessable Entity *before* it ever touches the SQL ORM level.\n