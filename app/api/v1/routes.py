from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.deps import get_current_user_with_role
from app.models.models import UserRole, User, Route, RouteStop
from app.schemas.schemas import RouteCreate, RouteUpdate, RouteResponse
from app.services.audit_service import log_action

router = APIRouter(dependencies=[Depends(get_current_user_with_role(UserRole.ADMIN))])

@router.get("", response_model=List[RouteResponse])
async def read_routes(db: Annotated[AsyncSession, Depends(get_db)]):
    stmt = select(Route).options(selectinload(Route.stops))
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=RouteResponse)
async def create_route(route_in: RouteCreate, db: Annotated[AsyncSession, Depends(get_db)], current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))):
    route_data = route_in.model_dump(exclude={"stops"})
    route = Route(**route_data)
    db.add(route)
    await db.flush()
    
    for stop_in in route_in.stops:
        stop = RouteStop(route_id=route.id, **stop_in.model_dump())
        db.add(stop)
        
    await log_action(db, current_user.id, "CREATE", "Route", route.id)
    await db.commit()
    await db.refresh(route)
    stmt = select(Route).options(selectinload(Route.stops)).where(Route.id == route.id)
    route = (await db.execute(stmt)).scalar_one()
    return route

@router.put("/{id}", response_model=RouteResponse)
async def update_route(id: int, route_in: RouteUpdate, db: Annotated[AsyncSession, Depends(get_db)], current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))):
    route = await db.get(Route, id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    update_data = route_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(route, key, value)
        
    await log_action(db, current_user.id, "UPDATE", "Route", route.id)
    await db.commit()
    
    stmt = select(Route).options(selectinload(Route.stops)).where(Route.id == route.id)
    route = (await db.execute(stmt)).scalar_one()
    return route

@router.delete("/{id}")
async def delete_route(id: int, db: Annotated[AsyncSession, Depends(get_db)], current_user: User = Depends(get_current_user_with_role(UserRole.ADMIN))):
    route = await db.get(Route, id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
        
    route.is_active = False
    await log_action(db, current_user.id, "DELETE", "Route", route.id)
    await db.commit()
    return {"message": "Route deactivated"}
