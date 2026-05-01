from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.models.models import (
    Vehicle, GateLog, CameraReading, CrowdingEvent
)
from app.schemas.schemas import ANPRData, CameraData
from pydantic import BaseModel
from typing import Annotated, Optional, Tuple
from fastapi import Request
from app.core.rate_limit import limiter
import logging
import secrets
import re
import numpy as np
import cv2

_ocr_reader = None

def get_ocr_reader():
    global _ocr_reader
    if _ocr_reader is None:
        import easyocr
        _ocr_reader = easyocr.Reader(['en'], gpu=False)
    return _ocr_reader

logger = logging.getLogger(__name__)

# S1: API key dependency for hardware endpoints
async def verify_hardware_api_key(x_hardware_api_key: Optional[str] = Header(None)):
    key = x_hardware_api_key or ""
    if not secrets.compare_digest(key, settings.HARDWARE_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing hardware API key"
        )

router = APIRouter(dependencies=[Depends(verify_hardware_api_key)])


# ─── Plate matching helpers ──────────────────────────────────────────────────

# EasyOCR commonly misreads these characters. If exact match misses, we retry
# after substituting the Latin-letter form with the digit form. Deliberately
# one-directional: digits win, because number plates are digit-heavy.
_CONFUSABLES = str.maketrans({
    "O": "0", "I": "1", "L": "1",
    "S": "5", "B": "8", "Z": "2",
    "D": "0", "Q": "0",
})




def _normalize_plate(text: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (text or "").upper().strip())


async def _lookup_plate(db: AsyncSession, plate: str) -> Tuple[Optional[Vehicle], str]:
    """
    Two-stage lookup: exact match, then confusable-char fallback.
    Returns (vehicle, method) where method is 'exact', 'confusable', or 'none'.
    """
    from sqlalchemy import select

    v = await db.scalar(
        select(Vehicle).where(Vehicle.plate_number == plate)
    )
    if v:
        return v, "exact"

    fuzzy = plate.translate(_CONFUSABLES)
    if fuzzy != plate:
        v = await db.scalar(
            select(Vehicle).where(Vehicle.plate_number == fuzzy)
        )
        if v:
            return v, "confusable"

    return None, "none"


# ─── ANPR webhook (pre-processed JSON) ───────────────────────────────────────

@router.post("/anpr", status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def ingest_anpr(request: Request, data: ANPRData, db: Annotated[AsyncSession, Depends(get_db)]):
    """
    Ingests ANPR webhooks where the caller has already OCR'd the plate.
    Applies the same lookup logic as /anpr/upload_raw.
    """
    from app.core.sockets import manager

    logger.info(
        f"[GATE {data.gate_id}] /anpr webhook: plate='{data.plate_number}' confidence={data.confidence:.2f}"
    )

    plate_number = _normalize_plate(data.plate_number)
    event_type = "IGNORED"
    vehicle = None
    match_method = "none"

    # OCR confidence boundary: [0.60, 1.0] makes an active GRANT/DENY decision.
    # Confidence == 0.60 is included (NOT IGNORED). Below 0.60 → IGNORED.
    if data.confidence < 0.60:
        logger.info(
            f"[GATE {data.gate_id}] DECISION: IGNORED (confidence {data.confidence:.2f} below 0.60)"
        )
    elif not plate_number:
        logger.info(f"[GATE {data.gate_id}] DECISION: IGNORED (empty plate after normalization)")
    else:
        vehicle, match_method = await _lookup_plate(db, plate_number)
        event_type = "GRANTED" if vehicle else "DENIED"
        logger.info(
            f"[GATE {data.gate_id}] DECISION: {event_type}  plate={plate_number}  "
            f"match={match_method}  vehicle_id={vehicle.id if vehicle else None}"
        )

    db.add(GateLog(
        gate_id=data.gate_id,
        plate_number=plate_number,
        ocr_raw_text=data.plate_number,
        confidence=data.confidence,
        match_method=match_method,
        event=event_type,
        vehicle_id=vehicle.id if vehicle else None,
    ))
    await db.commit()

    alert_payload = _build_alert_payload(data.gate_id, plate_number, event_type, vehicle, match_method)
    if alert_payload:
        await manager.broadcast_to_role("MANAGER", alert_payload)
        await manager.broadcast_to_role("ADMIN", alert_payload)
        return alert_payload

    return {"status": "ignored"}


# ─── Passenger-count / crowding camera ───────────────────────────────────────

@router.post("/camera", status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def ingest_camera(request: Request, data: CameraData, db: Annotated[AsyncSession, Depends(get_db)]):
    """
    Ingests YOLOv8 passenger counts from an on-bus camera.
    Updates crowding score on the trip and triggers auto-dispatch at >90%.
    """
    from app.models.models import Trip
    from app.services.rotation_service import trigger_auto_dispatch
    from app.core.sockets import manager
    from sqlalchemy import select, func

    passenger_count = max(0, int(data.passenger_count))
    logger.info(f"[CAMERA] trip={data.trip_id} passenger_count={passenger_count}")

    trip = await db.scalar(select(Trip).where(Trip.id == data.trip_id))
    if not trip:
        logger.warning(f"[CAMERA] trip={data.trip_id} not found")
        raise HTTPException(status_code=404, detail="Trip not found")

    vehicle = await db.scalar(select(Vehicle).where(Vehicle.id == trip.vehicle_id))
    if not vehicle:
        logger.warning(f"[CAMERA] vehicle for trip={data.trip_id} not found")
        raise HTTPException(status_code=404, detail="Vehicle not found for trip")

    capacity = vehicle.capacity or 0
    if capacity <= 0:
        logger.error(
            f"[CAMERA] vehicle={vehicle.id} plate={vehicle.plate_number} has invalid capacity={capacity}; rejecting"
        )
        raise HTTPException(status_code=422, detail="Vehicle has invalid capacity (<=0)")

    crowding_score = min(passenger_count / capacity, 1.0)
    trip.passenger_count = passenger_count
    trip.crowding_score = crowding_score
    trip.is_crowded = crowding_score > 0.90

    db.add(CameraReading(
        trip_id=trip.id,
        vehicle_id=vehicle.id,
        passenger_count=passenger_count,
        crowding_score=crowding_score,
    ))

    # De-dup auto-dispatch and CrowdingEvent rows per trip so a flood
    # of camera POSTs for the same trip can't create N events / N dispatches.
    already_dispatched = await db.scalar(
        select(func.count()).select_from(CrowdingEvent).where(
            CrowdingEvent.trip_id == trip.id,
            CrowdingEvent.auto_dispatch_triggered == True,  # noqa: E712
        )
    ) or 0

    auto_dispatched = False
    if trip.is_crowded and not already_dispatched:
        try:
            auto_dispatched = await trigger_auto_dispatch(trip.id, db)
        except Exception as exc:  # auto-dispatch failure must not lose the reading
            logger.exception(f"[CAMERA] auto-dispatch for trip={trip.id} failed: {exc}")

    if crowding_score >= 0.70:
        # Only persist a new CrowdingEvent when the trip's crowding state is
        # newly elevated, OR this is the first successful dispatch for the trip.
        existing_for_trip = await db.scalar(
            select(func.count()).select_from(CrowdingEvent).where(
                CrowdingEvent.trip_id == trip.id,
            )
        ) or 0
        if existing_for_trip == 0 or auto_dispatched:
            db.add(CrowdingEvent(
                trip_id=trip.id,
                vehicle_id=vehicle.id,
                crowding_score=crowding_score,
                passenger_count=passenger_count,
                auto_dispatch_triggered=auto_dispatched,
            ))

    await db.commit()

    logger.info(
        f"[CAMERA] trip={trip.id} score={crowding_score:.2f} "
        f"crowded={trip.is_crowded} dispatched={auto_dispatched}"
    )

    if trip.is_crowded:
        await manager.broadcast_to_role("MANAGER", {
            "type": "crowding_alert",
            "severity": "HIGH",
            "trip_id": trip.id,
            "route_id": trip.route_id,
            "crowding_score": crowding_score,
            "message": (
                f"CRITICAL CROWDING on Trip {getattr(trip, 'trip_number', trip.id)}. "
                f"Auto-dispatch {'successful' if auto_dispatched else 'failed (no drivers/buses)'}."
            ),
        })

    return {"message": "Crowding updated", "score": crowding_score, "dispatched": auto_dispatched}


# ─── Device log ──────────────────────────────────────────────────────────────

class DeviceLogData(BaseModel):
    device: str
    msg: str

@router.post("/log", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("120/minute")
async def ingest_device_log(request: Request, data: DeviceLogData):
    """Receives diagnostic log messages from ESP32 devices."""
    logger.info(f"[DEVICE LOG] {data.device}: {data.msg}")
    return


# ─── Raw JPEG ANPR upload (gate camera, sensor-triggered) ────────────────────

@router.post("/anpr/upload_raw", status_code=status.HTTP_200_OK)
@limiter.limit("60/minute")
async def upload_raw_image(
    request: Request,
    gate_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Accepts raw JPEG bytes from an ESP32-CAM at the entry/exit gate.
    Runs EasyOCR, normalizes the plate, looks it up (exact → confusable fallback),
    writes one gate_logs row, and returns plain-text GRANTED or DENIED.
    """
    from app.core.sockets import manager

    body = await request.body()
    if not body:
        logger.warning(f"[GATE {gate_id}] empty JPEG body")
        raise HTTPException(status_code=400, detail="Empty image body")

    logger.info(f"[GATE {gate_id}] Sensor-triggered capture received: {len(body)} bytes")

    np_arr = np.frombuffer(body, dtype=np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if frame is None:
        logger.error(f"[GATE {gate_id}] cv2.imdecode failed on {len(body)}-byte payload")
        raise HTTPException(status_code=422, detail="Invalid image data — could not decode JPEG")

    reader = get_ocr_reader()
    results = reader.readtext(frame, detail=1)

    # Log every candidate EasyOCR returned so the operator can see exactly
    # what the camera read, with confidences. This is the row that explains
    # every "denied but plate is in DB" mystery.
    candidates = [(t, round(float(c), 2)) for _, t, c in results]
    logger.info(f"[GATE {gate_id}] OCR candidates: {candidates}")

    if not results:
        logger.info(f"[GATE {gate_id}] DECISION: IGNORED (no text detected)")
        db.add(GateLog(
            gate_id=gate_id,
            plate_number="",
            ocr_raw_text="",
            confidence=0.0,
            match_method="none",
            event="IGNORED",
            vehicle_id=None,
        ))
        await db.commit()
        return PlainTextResponse("DENIED: Unreadable plate")

    best = max(results, key=lambda r: r[2])
    raw_text, ocr_confidence = best[1], float(best[2])
    plate_number = _normalize_plate(raw_text)

    logger.info(
        f"[GATE {gate_id}] Best raw: '{raw_text}' @ {ocr_confidence:.2f}  →  "
        f"normalized: '{plate_number}'"
    )

    event_type = "IGNORED"
    vehicle = None
    match_method = "none"

    # OCR confidence boundary: [0.60, 1.0] makes an active GRANT/DENY decision.
    # Confidence == 0.60 is included (NOT IGNORED). Below 0.60 → IGNORED.
    if ocr_confidence < 0.60:
        logger.info(
            f"[GATE {gate_id}] DECISION: IGNORED (confidence {ocr_confidence:.2f} below 0.60)"
        )
    elif not plate_number:
        logger.info(f"[GATE {gate_id}] DECISION: IGNORED (empty plate after normalization)")
    else:
        vehicle, match_method = await _lookup_plate(db, plate_number)
        event_type = "GRANTED" if vehicle else "DENIED"
        logger.info(
            f"[GATE {gate_id}] DECISION: {event_type}  plate={plate_number}  "
            f"match={match_method}  vehicle_id={vehicle.id if vehicle else None}"
        )

    db.add(GateLog(
        gate_id=gate_id,
        plate_number=plate_number,
        ocr_raw_text=raw_text,
        confidence=ocr_confidence,
        match_method=match_method,
        event=event_type,
        vehicle_id=vehicle.id if vehicle else None,
    ))
    await db.commit()

    alert_payload = _build_alert_payload(gate_id, plate_number, event_type, vehicle, match_method)
    if alert_payload:
        await manager.broadcast_to_role("MANAGER", alert_payload)
        await manager.broadcast_to_role("ADMIN", alert_payload)

    return PlainTextResponse("GRANTED" if event_type == "GRANTED" else "DENIED")


def _build_alert_payload(
    gate_id: str,
    plate_number: str,
    event_type: str,
    vehicle: Optional[Vehicle],
    match_method: str,
) -> Optional[dict]:
    if event_type == "GRANTED":
        return {
            "type": "gate_auth",
            "event": "GATE_AUTH_GRANTED",
            "gate_id": gate_id,
            "plate_number": plate_number,
            "vehicle_id": vehicle.id if vehicle else None,
            "match_method": match_method,
            "message": f"Access granted to {plate_number}",
        }
    if event_type == "DENIED":
        return {
            "type": "gate_auth",
            "event": "UNAUTHORIZED_VEHICLE",
            "gate_id": gate_id,
            "plate_number": plate_number,
            "match_method": match_method,
            "message": f"Unauthorized access attempt by {plate_number}",
        }
    return None
