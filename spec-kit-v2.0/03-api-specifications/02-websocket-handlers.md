# Real-Time WebSocket Connection Orchestration
> **Cross-Reference**: See `PRD-v2.0.md` Section 5.5.7 (Notifications & WebSockets).

## Flow Matrix
Because standard REST cannot push to browsers, we use WebSockets. Because FastAPIs run in distinct, isolated Uvicorn workers, an event on Worker A will not inform a WebSocket connected to Worker B. **Redis solves this.**

## Connection Manager Architecture
```python
class ConnectionManager:
    def __init__(self):
        # Maps user_id -> list of active WebSocket objects
        self.active_connections: dict[int, list[WebSocket]] = defaultdict(list)
    
    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id].append(websocket)
        
    def disconnect(self, websocket: WebSocket, user_id: int):
        self.active_connections[user_id].remove(websocket)

    async def broadcast_to_role(self, message: dict, role: str, db_session):
        # Queries DB for all users of a role, then iterates and self.send_personal_message()
        pass
```

## Envelope Priority Subsystems
All JSON pushed to clients contains a `priority` flag explicitly parsed by Zustand on the React end:
* `"priority": "CRITICAL"` -> YOLOv8 >90% Crowding, Engine Failure >105C. (Forces modal popup/sound).
* `"priority": "HIGH"` -> ANPR Gate Authorized. (Renders highly visible toast).
* `"priority": "LOW"` -> Coordinate update, ticket validation sync. (Background state update only).\n