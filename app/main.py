from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine
from app.api.v1 import auth
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.services.scheduler import start_scheduler, scheduler
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.rate_limit import limiter
import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup:
    # (Tables are managed by Alembic)
    
    # Start Scheduler (non-blocking)
    try:
        start_scheduler()
    except Exception as e:
        logger.warning(f"Scheduler failed to start (non-critical): {e}")
    
    yield
    # Shutdown: clean up resources
    try:
        scheduler.shutdown(wait=False)
    except Exception:
        pass
    await engine.dispose()
    logger.info("Application shutdown complete")

app = FastAPI(
    title="Smart Bus Garage API",
    version="1.1",
    description="API for Smart Bus Garage Management System",
    lifespan=lifespan
)

# Rate limiter setup
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.middleware import SanitizationMiddleware
from app.middleware.idempotency import IdempotencyMiddleware
app.add_middleware(SanitizationMiddleware)
app.add_middleware(IdempotencyMiddleware)

# Include Routers
from app.api.v1 import admin, manager, driver, websocket, users, drivers, vehicles, routes, tickets, hardware, manager_ops

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(hardware.router, prefix="/api/v1/hardware", tags=["Hardware"])
app.include_router(manager_ops.router, prefix="/api/v1/manager", tags=["Manager Operations"])
# Register the split admin routes
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin Dashboard"])
app.include_router(users.router, prefix="/api/v1/admin/users", tags=["Admin Users"])
app.include_router(drivers.router, prefix="/api/v1/admin/drivers", tags=["Admin Drivers"])
app.include_router(vehicles.router, prefix="/api/v1/admin/vehicles", tags=["Admin Vehicles"])
app.include_router(routes.router, prefix="/api/v1/admin/routes", tags=["Admin Routes"])
app.include_router(tickets.router, prefix="/api/v1/admin/tickets", tags=["Admin Tickets"])

app.include_router(manager.router, prefix="/api/v1/manager", tags=["Manager"])
app.include_router(driver.router, prefix="/api/v1/drivers", tags=["Driver"])
app.include_router(websocket.router, tags=["WebSocket"])

@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "version": "1.1"}

@app.get("/", tags=["Health"])
async def root():
    return {"status": "healthy", "version": "1.1", "message": "Smart Bus Garage API Running"}

# Global Exception Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "body": str(exc.body) if hasattr(exc, "body") else None,
            "message": "Validation Error"
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "message": "Internal Server Error",
            "detail": "An unexpected error occurred. Please try again later."
        }
    )
