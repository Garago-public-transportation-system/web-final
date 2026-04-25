import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

_TTL = 86400  # 24 hours


class IdempotencyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._seen: dict[str, float] = {}  # key -> timestamp

    def _purge_expired(self):
        now = time.time()
        expired = [k for k, ts in self._seen.items() if now - ts > _TTL]
        for k in expired:
            del self._seen[k]

    async def dispatch(self, request: Request, call_next):
        idem_key = request.headers.get("idempotency-key")
        if not idem_key or request.method not in ["POST", "PUT", "PATCH"]:
            return await call_next(request)

        cache_key = f"{request.method}:{request.url.path}:{idem_key}"

        if cache_key in self._seen:
            logger.warning(f"Blocking duplicate request with idempotency key: {idem_key}")
            return JSONResponse(status_code=409, content={"detail": "Duplicate request (Idempotency-Key already used)."})

        self._seen[cache_key] = time.time()
        self._purge_expired()

        try:
            response = await call_next(request)
            if response.status_code >= 500:
                self._seen.pop(cache_key, None)
            return response
        except Exception:
            self._seen.pop(cache_key, None)
            raise
