# React-Leaflet GIS Overlay
> **Cross-Reference**: See `PRD-v2.0.md` Section 5.2 (Fleet Operations Module).

## Blueprint
Google Maps is rejected due to enterprise api-cost limitations. `React-Leaflet` is strictly enforced pulling OpenStreetMap raster tiles.

## WebSocket Sync Rendering
Coordinate state (`{lat, lng, vehicle_id}`) is bound to React hooks that iterate over `<Marker />` components. 

## Alert Coloring Matrix
MUI `SvgIcon` pins evaluate threshold logic continuously:
* `speed == 0 AND time_elapsed_sec > 180` = Render **Orange**.
* `bus.crowding_score > 90%` = Render **Red** with pulsating CSS animation.
* `bus.status == DEVIATED` = Render flashing **Red/White** crosshair.