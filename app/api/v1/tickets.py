from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.deps import get_current_user_with_role
import secrets
from datetime import datetime, timezone
from app.models.models import UserRole, Ticket, Trip, TripTicketStatus, TripStatus
from app.schemas.schemas import TicketResponse

def generate_ticket_code() -> str:
    # 8-character alphanumeric unique ticket codes (A-HJ-NP-Z, 2-9 to avoid ambiguous chars like I, O, 1, 0)
    allowed_chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(allowed_chars) for _ in range(8))

# Admin tickets router — read-only oversight + validation.
# Ticket ISSUANCE moved to the driver router: POST /drivers/me/trips/{trip_id}/tickets
# (drivers issue tickets from the mobile app; admins should not create tickets).
router = APIRouter(dependencies=[Depends(get_current_user_with_role(UserRole.ADMIN, UserRole.DRIVER, UserRole.MANAGER))])

@router.post("/validate", response_model=TicketResponse)
async def validate_ticket(
    ticket_code: str,
    db: Annotated[AsyncSession, Depends(get_db)],
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

@router.get(
    "/",
    response_model=List[TicketResponse],
    dependencies=[Depends(get_current_user_with_role(UserRole.ADMIN, UserRole.MANAGER))],
)
async def read_tickets(db: Annotated[AsyncSession, Depends(get_db)], skip: int = 0, limit: int = 100):
    result = await db.execute(select(Ticket).offset(skip).limit(limit))
    return result.scalars().all()


@router.get(
    "/export",
    dependencies=[Depends(get_current_user_with_role(UserRole.ADMIN, UserRole.MANAGER))],
)
async def export_tickets(
    db: Annotated[AsyncSession, Depends(get_db)],
    format: str = "csv",
    status_filter: Optional[str] = None,
):
    """Export tickets as CSV or PDF. Supports an optional status filter (ISSUED/USED/CANCELLED/...)."""
    from fastapi.responses import StreamingResponse
    import io
    import csv as csv_module

    stmt = select(Ticket).order_by(Ticket.purchase_time.desc())
    if status_filter and status_filter.upper() != "ALL":
        stmt = stmt.where(Ticket.status == status_filter.upper())

    rows = (await db.execute(stmt)).scalars().all()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")

    if format.lower() == "pdf":
        try:
            from reportlab.lib.pagesizes import A4, landscape
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.lib import colors
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="reportlab is not installed. Run: pip install reportlab",
            )

        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=landscape(A4))
        styles = getSampleStyleSheet()
        elements = [
            Paragraph(
                f"Tickets — {status_filter or 'ALL'} ({len(rows)} rows)",
                styles["Title"],
            ),
            Spacer(1, 12),
        ]
        table_data = [["ID", "Code", "Trip", "Passenger", "Seat", "Status", "Price", "Purchased"]]
        for t in rows:
            table_data.append([
                t.id,
                t.ticket_code or "",
                t.trip_id,
                t.passenger_name or "",
                t.seat_number or "",
                t.status,
                f"{(t.price or 0):.2f}",
                t.purchase_time.strftime("%Y-%m-%d %H:%M") if t.purchase_time else "",
            ])
        table = Table(table_data, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2d2b26")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f3ee")]),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d8d6cf")),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(table)
        doc.build(elements)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=tickets_{timestamp}.pdf"},
        )

    # Default CSV
    buf = io.StringIO()
    writer = csv_module.writer(buf)
    writer.writerow(["ID", "Code", "Trip", "Passenger", "Seat", "Status", "Price", "Purchased", "Validated"])
    for t in rows:
        writer.writerow([
            t.id,
            t.ticket_code or "",
            t.trip_id,
            t.passenger_name or "",
            t.seat_number or "",
            t.status,
            f"{(t.price or 0):.2f}",
            t.purchase_time.strftime("%Y-%m-%d %H:%M") if t.purchase_time else "",
            t.validation_time.strftime("%Y-%m-%d %H:%M") if t.validation_time else "",
        ])
    buf.seek(0)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=tickets_{timestamp}.csv"},
    )
