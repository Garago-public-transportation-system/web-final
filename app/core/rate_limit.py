from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared Rate limiter: 100 requests/minute per IP by default
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
