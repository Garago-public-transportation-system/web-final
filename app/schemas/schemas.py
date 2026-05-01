from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator
import re
from app.models.models import (
    UserRole, DriverStatus, VehicleStatus, TripStatus, TripDirection,
    MaintenanceStatus, MaintenanceType, ShiftType, RotationPosition, ReplacementReason,
    TripTicketStatus, NotificationStatus, RerouteStatus
)

# --- Shared Config ---
class BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

def _validate_password_strength(password: str) -> str:
    """Shared password strength validator."""
    if len(password) < 8:
        raise ValueError('Password must be at least 8 characters long')
    if not re.search(r'[A-Z]', password):
        raise ValueError('Password must contain at least one uppercase letter')
    if not re.search(r'[a-z]', password):
        raise ValueError('Password must contain at least one lowercase letter')
    if not re.search(r'\d', password):
        raise ValueError('Password must contain at least one digit')
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        raise ValueError('Password must contain at least one special character (!@#$%^&*...)')
    return password

# --- Auth & User ---
class UserBase(BaseSchema):
    email: EmailStr
    full_name: str
    phone: Optional[str] = Field(None, pattern=r'^\+?[1-9]\d{1,14}$')
    role: UserRole
    preferred_language: str = "en"
    is_active: bool = True

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters long")

    @field_validator('password')
    @classmethod
    def password_strength(cls, v):
        return _validate_password_strength(v)

class UserUpdate(BaseSchema):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = Field(None, pattern=r'^\+?[1-9]\d{1,14}$')
    role: Optional[UserRole] = None
    preferred_language: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8)

    @field_validator('password')
    @classmethod
    def password_strength(cls, v):
        if v is not None:
            return _validate_password_strength(v)
        return v

class UserResponse(UserBase):
    # Override `phone` to drop the input-only regex pattern. Same reasoning
    # as VehicleResponse.plate_number: legacy rows must serialize cleanly
    # even if their phone format predates the current regex contract.
    phone: Optional[str] = None
    id: int
    created_at: datetime
    updated_at: datetime

class Token(BaseSchema):
    access_token: str
    token_type: str
    refresh_token: Optional[str] = None

class TokenData(BaseSchema):
    email: Optional[str] = None

class LoginRequest(BaseSchema):
    username: str # OAuth2 compatible (email)
    password: str

class RefreshRequest(BaseSchema):
    refresh_token: str

class SignupRequest(BaseSchema):
    email: EmailStr
    full_name: str
    password: str = Field(..., min_length=8)
    role: UserRole
    phone: Optional[str] = Field(None, pattern=r'^\+?[1-9]\d{1,14}$')

    @field_validator('password')
    @classmethod
    def password_strength(cls, v):
        return _validate_password_strength(v)

# --- Driver ---
class DriverBase(BaseSchema):
    license_number: str
    license_expiry: Optional[date] = None
    garage_id: Optional[int] = None

class DriverCreate(DriverBase):
    user_id: Optional[int] = None # Can be passed or inferred
    user: Optional[UserCreate] = None # For nested creation

class DriverUpdate(BaseSchema):
    license_number: Optional[str] = None
    license_expiry: Optional[date] = None
    garage_id: Optional[int] = None
    status: Optional[DriverStatus] = None
    current_vehicle_id: Optional[int] = None
    current_route_id: Optional[int] = None
    rating: Optional[float] = Field(None, ge=0, le=5)

class DriverResponse(DriverBase):
    id: int
    user_id: int
    user: Optional[UserResponse] = None
    status: DriverStatus
    current_vehicle_id: Optional[int]
    current_route_id: Optional[int]
    total_trips_today: int
    total_trips_all_time: int
    rating: float
    break_time_remaining: float
    total_break_time_today: float
    trips_since_last_break: int
    current_shift: Optional[ShiftType]
    created_at: datetime
    updated_at: datetime

# --- Vehicle ---
class VehicleBase(BaseSchema):
    plate_number: str = Field(..., pattern=r'^[A-Z0-9-]{3,10}$', description="License plate number (3-10 alphanumeric characters and hyphens)")
    model: str
    year: Optional[int] = Field(None, ge=1900, le=2100)
    capacity: int = Field(50, gt=0)
    garage_id: Optional[int] = None

class VehicleCreate(VehicleBase):
    pass

class VehicleUpdate(BaseSchema):
    plate_number: Optional[str] = Field(None, pattern=r'^[A-Z0-9-]{3,10}$')
    model: Optional[str] = None
    year: Optional[int] = Field(None, ge=1900, le=2100)
    capacity: Optional[int] = Field(None, gt=0)
    garage_id: Optional[int] = None
    status: Optional[VehicleStatus] = None

class VehicleResponse(VehicleBase):
    # Override `plate_number` to drop the input-only regex pattern.
    # Reason: legacy/seed rows may not match the strict pattern that we
    # enforce at create/update time (e.g. plate "Hi" from early seed data).
    # Output validation must not 500 on otherwise-readable rows; the input
    # boundary is still validated via VehicleCreate / VehicleUpdate.
    plate_number: str
    id: int
    status: VehicleStatus
    last_maintenance_date: Optional[date]
    created_at: datetime
    updated_at: datetime

# --- Route & Stops ---
class RouteStopBase(BaseSchema):
    stop_name: str
    sequence_order: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    dwell_time_minutes: float = 2.0

class RouteStopCreate(RouteStopBase):
    pass

class RouteStopResponse(RouteStopBase):
    id: int
    route_id: int

class RouteBase(BaseSchema):
    name: str
    start_location: str
    end_location: str
    distance_km: Optional[float] = None
    estimated_time_minutes: float
    fare: float = 0.0
    turnaround_time_minutes: float = 10.0
    is_active: bool = True

class RouteCreate(RouteBase):
    stops: List[RouteStopCreate] = []

class RouteUpdate(BaseSchema):
    name: Optional[str] = None
    is_active: Optional[bool] = None

class RouteResponse(RouteBase):
    id: int
    created_at: datetime
    updated_at: datetime
    stops: List[RouteStopResponse] = []

# --- Rotation ---
class RotationAssignmentBase(BaseSchema):
    route_id: int
    driver_id: int
    vehicle_id: int
    shift_type: ShiftType
    position: RotationPosition
    shift_date: date
    shift_start_time: datetime
    shift_end_time: datetime

class RotationAssignmentCreate(RotationAssignmentBase):
    pass

class RotationAssignmentResponse(RotationAssignmentBase):
    id: int
    is_active: bool
    created_at: datetime
    # Nested minimal responses if needed
    driver_name: Optional[str] = None
    vehicle_plate: Optional[str] = None
    route_name: Optional[str] = None

class RotationOverrideRequest(BaseSchema):
    driver_id: int
    vehicle_id: int
    reason: Optional[str] = None

# --- Trip ---
class TripBase(BaseSchema):
    driver_id: int
    vehicle_id: int
    route_id: int
    direction: TripDirection
    scheduled_start: datetime
    scheduled_end: Optional[datetime] = None

class TripCreate(TripBase):
    rotation_assignment_id: Optional[int] = None
    trip_number: Optional[str] = None

class TripUpdate(BaseSchema):
    status: Optional[TripStatus] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    passenger_count: Optional[int] = None
    is_crowded: Optional[bool] = None
    notes: Optional[str] = None

class TripResponse(TripBase):
    id: int
    status: TripStatus
    trip_number: Optional[str]
    actual_start: Optional[datetime]
    actual_end: Optional[datetime]
    passenger_count: int
    crowding_score: float
    is_crowded: bool
    fare_collected: float
    is_late: bool
    created_at: datetime
    updated_at: datetime
    # M7: Nested route and vehicle for driver trip details
    route: Optional[RouteResponse] = None
    vehicle: Optional[VehicleResponse] = None

# --- ANPR Data ---
class ANPRData(BaseModel):
    plate_number: str
    confidence: float
    gate_id: str

# --- Camera Data ---
class CameraData(BaseModel):
    trip_id: int
    passenger_count: int

# --- Driver GPS Ingest ---
class DriverGpsIngest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    recorded_at: Optional[datetime] = None

# --- Maintenance ---
class MaintenanceCreate(BaseSchema):
    vehicle_id: int
    type: MaintenanceType
    title: str
    description: Optional[str] = None
    priority: int = 3
    estimated_cost: Optional[float] = None


class MaintenanceRequestCreate(BaseSchema):
    """Public-facing payload for `POST /maintenance-requests`.

    The current authenticated user is taken as the requester; type defaults to
    REGULAR and is overridden to EMERGENCY when priority is 1 (highest)."""

    issue_description: str = Field(..., min_length=3, max_length=2000)
    vehicle_id: int = Field(..., gt=0)
    priority: int = Field(3, ge=1, le=5, description="1 = highest, 5 = lowest")

class MaintenanceResponse(BaseSchema):
    id: int
    vehicle_id: int
    requested_by_id: int
    approved_by_id: Optional[int]
    status: MaintenanceStatus
    type: MaintenanceType
    title: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime

class MaintenanceRejectRequest(BaseSchema):
    reason: str

# --- Notification ---
class NotificationBase(BaseSchema):
    title: str
    message: str
    notification_type: str

class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    status: NotificationStatus
    created_at: datetime

# --- Exchange ---
class DriverExchangeResponse(BaseSchema):
    id: int
    outgoing_driver_id: int
    incoming_driver_id: int
    reason: ReplacementReason
    exchange_time: datetime
    created_at: datetime

# --- Break ---
class BreakLogResponse(BaseSchema):
    id: int
    driver_id: int
    start_time: datetime
    end_time: Optional[datetime]
    duration_minutes: Optional[float]

# --- Admin Dashboard Stats ---
class AdminDashboardStats(BaseSchema):
    total_vehicles: int
    total_drivers: int
    total_routes: int
    total_users: int
    pending_maintenance: int
    active_trips: int
    trips_per_route: List[Dict[str, Any]] = []

# --- Manager Dashboard Stats ---
class ManagerDashboardStats(BaseSchema):
    trips_today: int
    total_revenue: float
    on_time_percentage: float
    crowding_alerts: int
    pending_maintenance: int

# --- Daily Report ---
class DailyReportResponse(BaseSchema):
    id: int
    report_date: date
    total_trips: int
    completed_trips: int
    total_revenue: float
    on_time_percentage: float
    created_at: datetime

# --- Audit Log ---
class AuditLogResponse(BaseSchema):
    id: int
    user_id: Optional[int]
    action: str
    entity_type: str
    entity_id: Optional[int]
    created_at: datetime
    updated_at: datetime

# --- Tickets ---
class TicketBase(BaseSchema):
    trip_id: int
    passenger_name: Optional[str] = None
    seat_number: Optional[str] = None
    price: float
    status: TripTicketStatus = TripTicketStatus.ISSUED

class TicketCreate(TicketBase):
    pass

class DriverTicketIssueRequest(BaseSchema):
    """Driver-side ticket-issue payload. trip_id is taken from the URL,
    price is determined server-side from the route fare, and status is
    always ISSUED — none of those can be set by the client."""
    passenger_name: Optional[str] = None
    seat_number: Optional[str] = None

class TicketResponse(TicketBase):
    id: int
    ticket_code: str
    purchase_time: datetime
    validation_time: Optional[datetime]
    created_at: datetime

# --- Composite Schemas ---
class UserWithDriverCreate(BaseSchema):
    user: UserCreate
    driver: DriverBase

# --- Crowding Event ---
class CrowdingEventResponse(BaseSchema):
    id: int
    trip_id: int
    vehicle_id: int
    crowding_score: float
    passenger_count: int
    auto_dispatch_triggered: bool
    recorded_at: datetime

# --- Reroute ---
class RerouteRequest(BaseSchema):
    reason: Optional[str] = None
    suggested_route_id: Optional[int] = None

class RerouteDecision(BaseSchema):
    reason: Optional[str] = None

class RerouteLogResponse(BaseSchema):
    id: int
    driver_id: int
    trip_id: Optional[int]
    original_route_id: Optional[int]
    new_route_id: Optional[int]
    approved_by: Optional[int]
    status: RerouteStatus
    reason: Optional[str]
    requested_at: datetime
    created_at: datetime

# --- Gate Camera ---
class GateCameraBase(BaseSchema):
    location_name: str
    ip_address: str
    gate_type: str
    is_active: bool = True

class GateCameraCreate(GateCameraBase):
    pass

class GateCameraResponse(GateCameraBase):
    id: int
    created_at: datetime
    updated_at: datetime

# --- Password Change ---
class PasswordChangeRequest(BaseSchema):
    current_password: str
    new_password: str = Field(..., min_length=8)

    @field_validator('new_password')
    @classmethod
    def password_strength(cls, v):
        return _validate_password_strength(v)

# --- User Profile Update (self-service) ---
class UserProfileUpdate(BaseSchema):
    full_name: Optional[str] = None
    phone: Optional[str] = Field(None, pattern=r'^\+?[1-9]\d{1,14}$')
    preferred_language: Optional[str] = None


class ProfileUpdateRequest(BaseSchema):
    """Payload for `PATCH /users/profile`. Accepts `phone_number` as an alias
    for the underlying `phone` column."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = Field(
        None, alias="phone", pattern=r'^\+?[1-9]\d{1,14}$'
    )


# --- Forgot / Reset Password ---
class ForgotPasswordRequest(BaseSchema):
    email: EmailStr


class TripAssignRequest(BaseSchema):
    driver_id: int
    vehicle_id: Optional[int] = None  # auto-selects a FREE vehicle when omitted

class ResetPasswordRequest(BaseSchema):
    token: str = Field(..., min_length=16, max_length=256)
    new_password: str = Field(..., min_length=8)

    @field_validator('new_password')
    @classmethod
    def password_strength(cls, v):
        return _validate_password_strength(v)
