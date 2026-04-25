# System Architecture Blueprint
> **Cross-Reference**: See `PRD-v2.0.md` Section 5.8 (Architecture Overview Diagram).

## Full Technology Stack & Reasoning
* **Backend Framework**: `FastAPI` (Python 3.13+). Chosen over Django/Flask to natively support `async/await` high-volume WebSocket connections.
* **Primary Relational Store**: `PostgreSQL 15`. Chosen for GIS/JSONB capabilities, connected via `asyncpg`.
* **In-Memory Cache & Message Broker**: `Redis 7+`. Mandatory for stateful WebSocket Pub/Sub scaling and `SlowAPI` distributed rate limits.
* **Frontend SPA**: `React 19` (TypeScript 5). Explicitly strictly typed to prevent runtime errors.
* **Component Engine**: `MUI v5` configured tightly with `stylis-plugin-rtl` for native Arabic UI.
* **AI/Hardware Layer**: `YOLOv8` running locally on Edge Devices (Jetson Nano) and distinct ANPR Camera entry systems.

## Component Request Flow Matrix
1. **Ingress**: External HTTP/WSS requests hit `Nginx`.
2. **Reverse Proxy Rules**: Nginx terminates TLS (if active), ratelimits IPs at the network layer, and passes to ASGI `Uvicorn` workers.
3. **Application Layer Validation**: FastAPI applies Pydantic V2 validations, `bleach` HTML sanitization, and decodes JWT (`python-jose`).
4. **Data Layer Mutation**: SQLAlchemy 2.0 executes asynchronous queries against Postgres.
5. **Real-Time Delivery**: Successful mutations trigger Redis `PUBLISH` events. `ConnectionManager` subscriptions catch these and push generic JSON down to target WebSockets.\n