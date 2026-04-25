# Extended REST API Mappings
> **Cross-Reference**: See `PRD-v2.0.md` Section 5.10 (API Summary).

## Hardware & IoT Webhooks (High Throughput)
* `POST /api/v1/hardware/gps`
  * **Payload**: `{"vehicle_id": int, "lat": float, "lng": float, "speed": float}`
  * **Logic**: Handled asynchronously without complex DB joins. Dumps quickly into `gps_tracking`, patches `vehicles` row.
* `POST /api/v1/hardware/anpr/event`
  * **Payload**: `{"plate_string": str, "gate_id": str, "timestamp": str}`
  * **Logic**: Cross references `vehicles.plate_number`. Returns `200 OK {"open_gate": true}` within ~1.2s round trip.
* `POST /api/v1/hardware/iot/engine`
  * **Payload**: `{"temp_c": float, "pressure_psi": float}`
  * **Logic**: Evaluates thresholds. Triggers emergency WebSocket if breach occurs.

## Fleet Core Ops (Driver Tablets)
* `POST /api/v1/driver/rotation/check-in`
  * **Auth**: Driver JWT
  * **Logic**: Shifts Driver Profile -> `DRIVING`. Validates against `RotationAssignment`.
* `POST /api/v1/driver/tickets/validate`
  * **Payload**: `{"ticket_hash": str, "timestamp": str}`
  * **Logic**: Checks `used_at`. Rejects duplicates instantly.

## Manager Admin Panels
* `GET /api/v1/manager/fleet/live`
  * **Auth**: Manager/Admin JWT
  * **Logic**: Generates a massive JSON blob of all active routes, vehicles, and crowding states to populate the React-Leaflet base initialization layout.\n