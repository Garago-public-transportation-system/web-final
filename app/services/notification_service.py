from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Notification, User
from app.schemas.schemas import NotificationResponse
import logging

logger = logging.getLogger(__name__)

async def create_notification(
    db: AsyncSession,
    user_id: int,
    title: str,
    message: str,
    type: str
):
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=type
    )
    db.add(notification)
    
    # S2: Push via WebSocket to the target user's role group (not all users)
    try:
        from app.core.sockets import manager as socket_manager
        ws_message = {
            "type": type,
            "title": title,
            "message": message,
        }
        # Look up user's role to target the right group
        user = await db.scalar(select(User).where(User.id == user_id))
        if user and hasattr(user, 'role'):
            role_value = user.role.value if hasattr(user.role, 'value') else str(user.role)
            await socket_manager.broadcast_to_role(role_value, ws_message)
        else:
            logger.warning(f"Cannot send WebSocket notification: user {user_id} not found or has no role. Skipping broadcast.")
    except Exception as e:
        logger.warning(f"Failed to push WebSocket notification: {e}")
    
    return notification
