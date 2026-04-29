from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.core.database import AsyncSessionLocal
from app.services.rotation_service import generate_daily_schedule, process_rotations
from app.models.models import Driver
from app.core.config import settings
from sqlalchemy import select
from datetime import date
import logging

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def scheduled_assignment_job():
    logger.info("Starting scheduled daily assignment job")
    async with AsyncSessionLocal() as db:
        try:
            assignments = await generate_daily_schedule(db, date.today())
            logger.info(f"Successfully generated {len(assignments)} assignments for today")
        except Exception as e:
            logger.error(f"Failed to generate daily assignments: {e}")

async def rotation_manager_job():
    logger.info("Running real-time rotation manager")
    async with AsyncSessionLocal() as db:
        try:
            await process_rotations(db)
        except Exception as e:
            logger.error(f"Rotation manager failed: {e}")

async def lateness_job():
    """GAP-06: every minute, flip `is_late` on ACTIVE trips past their grace
    window so DailyReport.on_time_percentage reflects reality."""
    async with AsyncSessionLocal() as db:
        try:
            from app.services.trip_service import update_late_trips
            flipped = await update_late_trips(db)
            if flipped:
                logger.info(f"Lateness job: marked {flipped} active trip(s) as late")
        except Exception as e:
            logger.error(f"Lateness job failed: {e}")

async def midnight_reset_job():
    """D2: Reset daily driver counters at midnight."""
    logger.info("Running midnight reset for all drivers")
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Driver))
            drivers = result.scalars().all()
            for d in drivers:
                d.total_trips_today = 0
                d.break_time_remaining = settings.BREAK_TIME_PER_SHIFT
                d.total_break_time_today = 0.0
                d.trips_since_last_break = 0
                d.current_break_number = 0
            await db.commit()
            logger.info(f"Reset daily counters for {len(drivers)} drivers")
        except Exception as e:
            logger.error(f"Midnight reset failed: {e}")


async def expire_trips_job():
    """Auto-inactivate trips whose scheduled_start is older than today."""
    async with AsyncSessionLocal() as db:
        try:
            from app.services.trip_service import deactivate_expired_trips
            flipped = await deactivate_expired_trips(db)
            if flipped:
                logger.info(f"Trip expiry job: deactivated {flipped} expired trip(s)")
        except Exception as e:
            logger.error(f"Trip expiry job failed: {e}")

def start_scheduler():
    # Run every day at 05:30
    scheduler.add_job(
        scheduled_assignment_job,
        CronTrigger(hour=5, minute=30),
        id="daily_assignments",
        replace_existing=True
    )
    
    # Check for rotations every 5 minutes
    # misfire_grace_time: allow the job to run up to 5 min late instead of being skipped
    # max_instances: prevent overlap if a previous run is still executing
    scheduler.add_job(
        rotation_manager_job,
        'interval',
        minutes=5,
        id="rotation_processor",
        replace_existing=True,
        misfire_grace_time=300,
        max_instances=1,
    )
    
    # GAP-06: Persist trip.is_late for active trips past their grace window.
    scheduler.add_job(
        lateness_job,
        'interval',
        minutes=1,
        id="lateness_persistence",
        replace_existing=True,
        misfire_grace_time=60,
        max_instances=1,
    )

    # D2: Reset daily counters at midnight
    scheduler.add_job(
        midnight_reset_job,
        CronTrigger(hour=0, minute=0),
        id="midnight_reset",
        replace_existing=True
    )

    # Auto-inactivate expired trips: run shortly after midnight, then hourly as a safety net.
    scheduler.add_job(
        expire_trips_job,
        CronTrigger(minute=1),
        id="trip_expiry",
        replace_existing=True,
        misfire_grace_time=300,
        max_instances=1,
    )

    scheduler.start()
    logger.info("APScheduler started")
