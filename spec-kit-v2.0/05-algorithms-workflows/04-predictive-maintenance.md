# Predictive Analytics: IoT Triggers
> **Cross-Reference**: See `PRD-v2.0.md` Section 5.6 (Predictive Maintenance).

## Real-Time Engine Safeguards
Replacing manual breakdown reporting with absolute data-thresholds.

1. `/api/v1/hardware/iot/engine` ingests JSON metric arrays from bus OBD2 endpoints.
2. The logic evaluates hard constraints designed to prevent physical bus destruction:
   * **Engine Block Temp** > 105°C
   * **Absolute Oil Pressure** < 25 PSI
   * **Battery Voltage Output** < 11.8V
3. Any breach triggers a `MaintenanceRequest(priority="EMERGENCY")` DB insert and pings a `CRITICAL` WebSocket event directly to the Maintenance staff accounts.\n