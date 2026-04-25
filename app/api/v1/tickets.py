from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user_with_role
import secrets
from datetime import datetime, timezone
from app.models.models import UserRole, User, Ticket, Trip, Driver, Vehicle, Route, TripTicketStatus, TripStatus
from app.schemas.schemas import TicketCreate, TicketResponse

def generate_ticket_code() -> str:
    # 8-character alphanumeric unique ticket codes (A-HJ-NP-Z, 2-9 to avoid ambiguous chars like I, O, 1, 0)
    allowed_chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(allowed_chars) for _ in range(8))

router = APIRouter(dependencies=[Depends(get_current_user_with_role(UserRole.ADMIN, UserRole.DRIVER))])

@router.post("", response_model=TicketResponse)
async def create_ticket(
    ticket_in: TicketCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN, UserRole.DRIVER))
):
    trip = await db.get(Trip, ticket_in.trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
        
    if trip.status != TripStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Tickets can only be issued for currently active trips.")
    
    if current_user.role == UserRole.DRIVER:
        driver_res = await db.execute(select(Driver).where(Driver.user_id == current_user.id))
        driver = driver_res.scalar_one()
        if trip.driver_id != driver.id:
            raise HTTPException(status_code=403, detail="Not authorized to issue tickets for this trip")
    
    vehicle = await db.get(Vehicle, trip.vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=400, detail="Trip has no assigned vehicle")
    
    bus_capacity = vehicle.capacity if hasattr(vehicle, 'capacity') else 50
    
    count_stmt = select(func.count(Ticket.id)).where(Ticket.trip_id == ticket_in.trip_id)
    current_count = await db.scalar(count_stmt)
    
    if current_count >= bus_capacity:
        raise HTTPException(status_code=400, detail=f"Bus is full! Capacity: {bus_capacity}")
        
    if ticket_in.seat_number:
        seat_stmt = select(Ticket).where(
            Ticket.trip_id == ticket_in.trip_id,
            Ticket.seat_number == ticket_in.seat_number
        )
        if (await db.execute(seat_stmt)).scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Seat {ticket_in.seat_number} is already taken")

    # Generate unique ticket code
    while True:
        code = generate_ticket_code()
        exists = await db.scalar(select(Ticket.id).where(Ticket.ticket_code == code))
        if not exists:
            break

    # C6: Use route fare instead of client-provided price (security: never trust client price)
    DEFAULT_TICKET_FARE = 15.0
    route = await db.get(Route, trip.route_id)
    ticket_price = route.fare if route and route.fare > 0 else DEFAULT_TICKET_FARE
    
    ticket = Ticket(
        trip_id=ticket_in.trip_id,
        passenger_name=ticket_in.passenger_name,
        seat_number=ticket_in.seat_number,
        price=ticket_price,
        ticket_code=code
    )
    db.add(ticket)
    
    # F6: Increment passenger count on the trip
    trip.passenger_count = (trip.passenger_count or 0) + 1
    
    await db.commit()
    await db.refresh(ticket)
    return ticket

@router.post("/validate", response_model=TicketResponse, dependencies=[Depends(get_current_user_with_role(UserRole.ADMIN, UserRole.DRIVER, UserRole.MANAGER))])
async def validate_ticket(
    ticket_code: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN, UserRole.DRIVER, UserRole.MANAGER))
):
    ticket = await db.scalar(select(Ticket).where(Ticket.ticket_code == ticket_code).with_for_update())
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    if ticket.status == TripTicketStatus.USED:
        raise HTTPException(status_code=400, detail="Ticket has already been used (Duplicate Scan)")
    elif ticket.status != TripTicketStatus.ISSUED:
        raise HTTPException(status_code=400, detail=f"Ticket is invalid: {ticket.status.value}")
    
    # D3: Verify the associated trip is still active
    trip = await db.get(Trip, ticket.trip_id)
    if trip and trip.status != TripStatus.ACTIVE:
        raise HTTPException(status_code=400, detail=f"Cannot validate ticket — trip is {trip.status.value}, not ACTIVE.")
        
    ticket.status = TripTicketStatus.USED
    ticket.validation_time = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(ticket)
    return ticket

@router.get("/", response_model=List[TicketResponse])
async def read_tickets(db: Annotated[AsyncSession, Depends(get_db)], skip: int = 0, limit: int = 100):
    result = await db.execute(select(Ticket).offset(skip).limit(limit))
    return result.scalars().all()
