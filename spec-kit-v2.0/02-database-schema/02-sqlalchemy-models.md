# SQLAlchemy 2.0 Implementation Standard
> **Cross-Reference**: See `PRD-v2.0.md` Section 5.9 (Target Models).

## Mandatory Base Rules
1. Legacy `declarative_base()` is forbidden. Use `DeclarativeBase` native classes.
2. Type hinting via `Mapped[T]` and `mapped_column()` is strictly required for auto-completion.
3. Use `func.now()` for native database-side timestamping to avoid differing local python timezone issues.

## Complex Example: Rotation Assignment
```python
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Integer, DateTime, ForeignKey, Enum, String
from sqlalchemy.sql import func
import enum
from datetime import datetime
from app.core.database import Base

class AssignmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    RELIEVED = "RELIEVED"

class RotationAssignment(Base):
    __tablename__ = "rotation_assignments"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    
    # Track the exact start and relief intervals to calculate fatigue
    assigned_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    start_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    
    status: Mapped[AssignmentStatus] = mapped_column(Enum(AssignmentStatus), default=AssignmentStatus.PENDING)
    shift_type: Mapped[str] = mapped_column(String(50)) # e.g., 'D1_OUTBOUND', 'D3_RELIEF'
```\n