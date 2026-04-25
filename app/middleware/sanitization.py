import json
import bleach
from starlette.types import ASGIApp, Receive, Scope, Send


class SanitizationMiddleware:
    """
    Pure ASGI middleware that sanitizes all string fields in JSON request bodies.
    Uses bleach.clean() to strip HTML tags, preventing XSS attacks.
    
    This approach intercepts the raw ASGI `receive` callable BEFORE FastAPI
    caches the body, ensuring sanitization actually takes effect.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET")
        if method not in ("POST", "PUT", "PATCH"):
            await self.app(scope, receive, send)
            return

        # Check Content-Type from headers
        headers = dict(
            (k.decode("latin-1").lower(), v.decode("latin-1"))
            for k, v in scope.get("headers", [])
        )
        content_type = headers.get("content-type", "")

        if "application/json" not in content_type:
            await self.app(scope, receive, send)
            return

        # Collect the full body
        body_chunks = []
        body_complete = False

        async def sanitized_receive():
            nonlocal body_complete
            if body_complete:
                # After we've already sent the sanitized body, just pass through
                return await receive()

            # Collect all chunks
            while True:
                message = await receive()
                body = message.get("body", b"")
                body_chunks.append(body)
                if not message.get("more_body", False):
                    break

            body_complete = True
            full_body = b"".join(body_chunks)

            if full_body:
                try:
                    data = json.loads(full_body)
                    sanitized = _sanitize_recursive(data)
                    full_body = json.dumps(sanitized).encode("utf-8")
                except json.JSONDecodeError:
                    pass  # Let FastAPI handle malformed JSON

            return {"type": "http.request", "body": full_body}

        # Update Content-Length header to match sanitized body length
        new_headers = []
        for key, value in scope.get("headers", []):
            if key.decode("latin-1").lower() == "content-length":
                continue  # Remove old Content-Length; it will be recalculated or omitted
            new_headers.append((key, value))
        scope["headers"] = new_headers

        await self.app(scope, sanitized_receive, send)


def _sanitize_recursive(data):
    """Recursively sanitize strings in lists and dictionaries."""
    if isinstance(data, dict):
        return {k: _sanitize_recursive(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [_sanitize_recursive(v) for v in data]
    elif isinstance(data, str):
        return bleach.clean(data, tags=[], attributes={}, strip=True)
    else:
        return data
