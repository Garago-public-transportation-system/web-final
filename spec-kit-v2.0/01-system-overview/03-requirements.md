# System Constraints & Requirements
> **Cross-Reference**: See `PRD-v2.0.md` Section 5.7 (Constraints & Assumptions).

## Specific Environmental Constraints
* **Temperature Thresholds**: Due to Cairo summers, physical on-bus edge devices (YOLOv8 Nanos, GPS beacons) must operate under 45°C ambient temperatures. Minimum IP54 dust protection required.
* **Network Volatility**: 4G connectivity dropouts are expected. 
    * *Driver Tablets* must utilize local IndexedDB queues to store check-ins / ticket validations offline.
    * *Sync Engine*: Upon network restoration, tablets must securely POST historical arrays bearing originally generated timestamps.
* **Language/Localization**: The system mandates Arabic as the primary localization constraint (RTL DOM rendering). English is supported globally via `react-i18next` toggle.

## Infrastructure Sovereignty Restrictions
* Due to data privacy, no cloud integrations (AWS/GCP/Azure) are permitted for raw database hosting.
* The system is provisioned on local bare-metal Linux (Ubuntu 24.04 LTS) servers in the Cairo headquarters.
* Maps utilize OpenStreetMap via `react-leaflet` to avoid third-party API keys (e.g., Google Maps) sending telemetry externally.\n