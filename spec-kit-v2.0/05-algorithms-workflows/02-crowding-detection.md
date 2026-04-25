# AI Vision Crowding Analysis
> **Cross-Reference**: See `PRD-v2.0.md` Section 5.2 (YOLOv8 Crowding Integration).

## Mechanical Loop
This system integrates physical Edge AI into the web application:
1. **Edge Node**: Jetson Nano (installed over the bus entrance) runs raw tensor operations on a YOLOv8 head-counting dataset.
2. **Payload Fire**: It posts `{"vehicle_id": 12, "passenger_count": 87}`.

## API Response Logic & Auto-Dispatch
The FastAPI backend ingests the payload asynchronously and checks the relation `vehicles.max_capacity`:
```python
capacity_percentage = payload.passenger_count / vehicle.max_capacity

if capacity_percentage > 0.90:
    # 1. Fire WebSockets
    await manager.broadcast_critical(f"Bus {vehicle.plate} exceeded 90% capacity!")
    
    # 2. Trigger Autonomous Dispatch
    resting_d3_driver = await find_nearest_status_free_driver(vehicle.route_id)
    if resting_d3_driver:
         await generate_emergency_rotation(resting_d3_driver, vehicle.route_id)
```\n