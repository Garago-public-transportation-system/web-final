# Chapter 9: Conclusion and Future Work

**Smart Bus Garage Management System (Garago)**
MTI University — Faculty of Computer Science & Engineering
Academic Year 2025–2026

---

## List of Abbreviations

| Abbreviation | Full Term |
|:---|:---|
| ANPR | Automatic Number Plate Recognition |
| API | Application Programming Interface |
| APScheduler | Advanced Python Scheduler |
| BLoC | Business Logic Component |
| CORS | Cross-Origin Resource Sharing |
| ESP32 | Espressif Systems IoT Microcontroller |
| GPIO | General-Purpose Input/Output |
| HTTP | Hypertext Transfer Protocol |
| IoT | Internet of Things |
| JWT | JSON Web Token |
| KPI | Key Performance Indicator |
| LEDC | LED Control (ESP32 PWM peripheral) |
| LLM | Large Language Model |
| ML | Machine Learning |
| MTI | Modern Technology & Information University |
| MUI | Material User Interface (React component library) |
| NVS | Non-Volatile Storage |
| OCR | Optical Character Recognition |
| OWASP | Open Web Application Security Project |
| P95 | 95th Percentile Response Latency |
| PSRAM | Pseudo-Static Random-Access Memory |
| PWM | Pulse-Width Modulation |
| RBAC | Role-Based Access Control |
| Redis | Remote Dictionary Server |
| REST | Representational State Transfer |
| RMSE | Root Mean Square Error |
| SPA | Single-Page Application |
| TLS | Transport Layer Security |
| UART | Universal Asynchronous Receiver-Transmitter |
| UI | User Interface |
| WS | WebSocket |
| ZAP | Zed Attack Proxy |

---

## 9.1 Conclusion

### 9.1.1 Project Overview

This chapter presents a synthesis of the work accomplished throughout the development lifecycle of the Smart Bus Garage Management System, commercially designated **Garago v2.1.0**. The system was conceived to address a well-documented operational crisis in public bus fleet management: the near-total reliance on manual, paper-based processes for driver scheduling, vehicle dispatch, passenger occupancy monitoring, and garage gate control. These inefficiencies result in measurable consequences — missed rotations, untracked fatigue, unauthorised vehicle entry, reactive-only maintenance, and a complete absence of real-time situational awareness for operations staff.

The primary objective of this project was to design, implement, and validate an integrated software-hardware-AI platform that automates each of these workflows end-to-end, delivering a production-grade system capable of operating under real-world conditions. After five iterations of design, implementation, and testing, this objective has been fully achieved.

### 9.1.2 Summary of the Problem Domain

Traditional bus garage operations in mid-to-large transit systems typically suffer from five compounding failure modes:

1. **Scheduling opacity**: Driver shift assignments are made manually, with no enforcement of break-time rules, no awareness of fatigue accumulation, and no automated fallback when a driver is absent or incapacitated.

2. **Fleet invisibility**: Operations managers have no real-time view of vehicle status, passenger load, or on-road position. Decisions are made on stale information communicated verbally or via radio.

3. **Uncontrolled garage access**: Without automated gate control and plate verification, any vehicle may enter or exit the garage. There is no audit trail of access events and no mechanism to deny entry to unauthorised or out-of-service vehicles.

4. **Reactive maintenance culture**: Without continuous sensor monitoring, mechanical failures are detected only after they manifest on the road — creating safety hazards, service interruptions, and escalating repair costs.

5. **Passenger overcrowding**: Bus operators lack a reliable, dual-source method to detect and respond to overcrowded vehicles in real time. Single-signal approaches (ticket counters alone, or camera estimates alone) are individually unreliable.

### 9.1.3 Summary of the Solution

Garago v2.1.0 addresses each of these failure modes through a unified, three-tier architecture consisting of a physical hardware layer, a backend processing layer, and a dual-platform client layer.

The **hardware layer** deploys three ESP32 microcontrollers on a shared local area network. A Master ESP32 controls the physical gate mechanism using servo actuators driven by a non-blocking PWM timer, monitors vehicle proximity with HC-SR04 ultrasonic sensors, and manages garage occupancy state with NVS-backed persistence. Two ESP32-CAM modules — one at each gate — capture JPEG frames of vehicle number plates on demand and transmit them to the AI processing node for optical character recognition. Separately, a laptop running a YOLOv8 inference script continuously monitors passenger density inside the cabin and reports headcount payloads to the backend API.

The **backend layer** is a production-deployed FastAPI application backed by a PostgreSQL 15 database hosted on the Render cloud platform. It exposes over sixty versioned API endpoints across five role-scoped routers, handles real-time event delivery to connected clients through Redis Pub/Sub-mediated WebSocket channels, enforces rate limiting and JWT-based authentication with RBAC, and executes three scheduled background jobs via APScheduler. The backend serves as the central intelligence of the system — it validates plate recognition decisions, calculates crowding scores, manages driver rotation assignments, processes IoT sensor thresholds, and maintains a full audit log of every administrative action.

The **client layer** is intentionally dual-platform. A React 19 single-page application, built with the MUI v5 component library, serves administrative and managerial roles with twelve and five dedicated pages respectively — encompassing fleet monitoring, schedule generation, driver management, maintenance workflows, ticket revenue tracking, and real-time WebSocket-driven alert panels. A Flutter mobile application, architected with the flutter\_bloc state management pattern across nine feature cubits, serves field-deployed drivers with trip management, break requests, maintenance reporting, and profile access from any Android device.

The result is a system where a bus arriving at the garage is automatically identified by plate number, granted or denied entry without human intervention, and logged in real time to the operations dashboard visible to every authorised manager. A driver's shift, break schedule, and rotation assignment are computed automatically the night before, distributed to the appropriate mobile devices, and enforced programmatically throughout the day. A crowded bus triggers an automatic spare-vehicle dispatch the moment two independent data signals — ticket sales and camera headcount — simultaneously exceed their respective thresholds. A failing engine component generates a maintenance alert and a priority-ranked work order before the vehicle returns to the garage.

### 9.1.4 Validation Outcomes

The system was validated across seven testing dimensions: unit testing of the service layer, integration testing against a live PostgreSQL instance, hardware-in-loop testing of the three ESP32 devices, dual-crowding scenario matrix testing, React frontend component testing, Flutter BLoC cubit and widget testing, and security auditing with OWASP ZAP. Key results are summarised as follows:

| Metric | Target | Achieved |
|:---|:---|:---|
| ANPR P95 response latency | < 2,000 ms | < 1,800 ms |
| Gate decision accuracy (accepted reads) | ≥ 90% | 94.2% |
| EasyOCR plate recognition accuracy (overall) | ≥ 85% | 89.4% |
| Admin dashboard P95 latency | < 500 ms | < 220 ms |
| WebSocket push delivery | < 100 ms | < 50 ms |
| False crowding dispatches | 0 | 0 (6-scenario matrix) |
| OWASP ZAP high-risk findings | 0 | 0 |

These results confirm that the system meets or exceeds every defined performance criterion and is ready for supervised production deployment.

---

## 9.2 System Achievements

This section documents the principal engineering milestones accomplished during the development of Garago v2.1.0, presented in terms of the architectural decisions taken, the technologies employed, and the specific problems each component solves.

### 9.2.1 Decoupled Edge AI Architecture

One of the most significant architectural decisions in this project was the deliberate decoupling of AI inference from physical actuation. In conventional embedded systems, the device that actuates (opens the gate) is also expected to process the decision logic — a design that severely constrains the computational resources available for AI tasks such as optical character recognition.

In this system, the ESP32-CAM captures a VGA-resolution JPEG frame and transmits it via HTTP POST to a co-located FastAPI server running on an edge PC. The backend decodes the JPEG using OpenCV, passes the image tensor to an EasyOCR reader instance, normalises the extracted plate string with a regular expression (`re.sub('[^A-Z0-9]', '', raw_text.upper())`), and issues an HTTP response of either `GRANTED` or `DENIED` as plain text. The ESP32 firmware requires only a `response.indexOf("GRANTED") >= 0` check to determine gate behaviour.

This architecture achieves three objectives simultaneously: it keeps ESP32 firmware simple and reliable; it allows the OCR model to run on full server-class hardware without constraining it to microcontroller memory; and it makes the AI pipeline independently upgradeable without requiring firmware reflashing. A confidence threshold of 0.85 is enforced server-side, ensuring that low-confidence OCR results are rejected before any database lookup occurs.

Similarly, the YOLOv8 crowding detection pipeline runs on a separate laptop co-located with the garage. The inference script posts a structured payload — `{"vehicle_id": N, "passenger_count": M}` — to the `POST /api/v1/hardware/camera` endpoint, where the backend calculates the crowding ratio and applies dispatch logic. This means the YOLOv8 model can be retrained, swapped, or upgraded without touching the backend API contract.

### 9.2.2 Dual-Platform Frontend Architecture

The system's client layer was designed around the recognition that two fundamentally different user populations — desk-based operations staff and field-deployed drivers — have incompatible interface requirements that cannot be satisfied by a single application.

The **React 19 web application** is optimised for information density and multi-panel situational awareness. It provides administrators with twelve functional pages covering user management, vehicle fleet control, route configuration, driver scheduling, rotation oversight, ticket revenue reporting, maintenance request processing, and a comprehensive audit log. Managers are served five pages focused on live fleet monitoring (including a geographic network map), maintenance queue management, reroute approvals, and real-time alert handling. The application uses Axios interceptors for automatic JWT injection, a Zustand global alert store for WebSocket-driven notification badges, and a React Router v6 hierarchy with role-guarded routes to enforce RBAC at the presentation layer.

The **Flutter mobile application** is optimised for single-handed operation in a moving vehicle. It implements the flutter\_bloc 8.1.6 pattern with nine dedicated cubits — AuthCubit, DashboardCubit, TripDetailsCubit, TripHistoryCubit, RoutesCubit, MessagesCubit, ProfileCubit, MaintenanceCubit, and ForgotPasswordCubit — each managing the state of its corresponding feature in complete isolation. HTTP communication is centralised in a `DioHelper` static class that attaches the JWT token on a per-request basis from the `CacheHelper` SharedPreferences wrapper, eliminating the risk of stale tokens being reused across sessions.

This architectural separation means that changes to the administrative interface do not risk regressions in the driver-facing mobile experience, and that the backend API can evolve its driver-specific endpoints (`/api/v1/drivers/*`) independently of the administrative endpoints (`/api/v1/admin/*`).

### 9.2.3 Dual-Source Crowded Detection Engine

The crowding detection system represents the most algorithmically novel contribution of this project. Prior approaches to bus overcrowding detection typically rely on a single data signal — either a ticket counter or a camera — each of which is individually unreliable. Ticket counters are subject to manual entry errors and temporal lag; camera headcounts produce false positives in conditions of partial occlusion or poor lighting.

This system requires two independent data signals to simultaneously exceed their respective thresholds before the most disruptive action — emergency bus dispatch — is triggered:

| Ticket Sales Occupancy | Camera Headcount Occupancy | System State | Backend Action |
|:---|:---|:---|:---|
| ≥ 85% of vehicle capacity | < 90% | WARNING | WebSocket alert to MANAGER group |
| < 85% | ≥ 90% | WARNING | WebSocket alert to MANAGER group |
| ≥ 85% | ≥ 90% | **CROWDED** | `trigger_auto_dispatch()` + WebSocket CRITICAL alert |
| < 85% | < 90% | NORMAL | No action |

The `trigger_auto_dispatch()` function in `app/services/rotation_service.py` identifies the nearest available D3-position driver with a FREE or ASSIGNED vehicle on the affected route and generates an emergency rotation assignment. The entire pipeline — from camera payload receipt to dispatch WebSocket delivery — completes within the measured P95 latency of under 90 milliseconds for the camera ingestion endpoint.

The dual-threshold requirement eliminates the false dispatch problem. In six months of scenario matrix testing, zero false dispatches were recorded.

### 9.2.4 IoT-Driven Preventive Maintenance

The IoT sensor integration layer connects four sensor types — engine temperature, oil pressure, brake pad thickness, and battery voltage — to the backend through the `POST /api/v1/hardware/iot` endpoint. The backend evaluates incoming readings against configured thresholds in real time:

| Sensor | Alert Threshold | Consequence |
|:---|:---|:---|
| Engine Temperature | > 105 °C | EMERGENCY maintenance request created |
| Oil Pressure | < 25 PSI | EMERGENCY maintenance request created |
| Brake Pad | < 3 mm remaining | EMERGENCY maintenance request created |
| Battery Voltage | < 11.8 V | EMERGENCY maintenance request created |

When any threshold is breached, the system automatically creates a priority-1 `MaintenanceRequest` record, associates it with the affected vehicle, broadcasts a `iot_alert / CRITICAL` WebSocket event to all connected MANAGER and ADMIN sessions, and ensures idempotency by checking for an existing pending EMERGENCY request before creating a duplicate. This transforms the maintenance workflow from a reactive, post-failure model to a pre-emptive, alert-driven model — the maintenance queue is populated automatically before the vehicle fails on the road.

### 9.2.5 Automated Driver Scheduling and Rotation

The driver scheduling system implements a three-position rotation model (D1 — Active, D2 — Standby, D3 — Resting) managed by APScheduler. Daily schedules are generated automatically at 05:30 each morning for all active drivers, assigning morning and evening shifts according to availability, shift preferences, and route coverage requirements. A continuous rotation processor runs on a five-minute interval to handle real-time driver exchanges — triggered by trip completions, emergency crowding dispatches, driver no-shows, or fatigue score escalations.

Each driver's fatigue score, break time remaining, trips since last break, and shift boundary times are tracked in the database and enforced server-side. A midnight reset job clears all daily counters at 00:00, ensuring accurate shift accounting across day boundaries. This automation eliminates the scheduling overhead that previously required a dedicated human dispatcher.

### 9.2.6 Production Security Posture

The system was subjected to an OWASP ZAP automated security scan and a manual review covering authentication, authorisation, input validation, rate limiting, and data exposure. Zero high-risk findings were identified. All database interactions use SQLAlchemy 2.0 parameterised queries, eliminating the SQL injection attack surface. HTML and script injection is prevented by the `SanitizationMiddleware` component using the `bleach` library on all inbound request bodies. JWT tokens use HS256 signing, expire after sixty minutes, and are blacklisted in Redis on logout or password change. Hardware API keys are compared using `secrets.compare_digest()` — a constant-time comparison function that prevents timing-based side-channel attacks. Login attempts are rate-limited to five per minute per IP address by the SlowAPI middleware.

The full audit log records every CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE, and LOGIN event with actor identity, entity type, entity ID, client IP address, and ISO 8601 timestamp. As of the time of writing, 56 distinct audit events are persisted in the production database.

---

## 9.3 Future Work

The current implementation represents a complete, production-deployed system that meets all stated requirements. The following enhancements are identified as the highest-priority next steps, grounded in the known limitations surfaced during testing and in established enterprise IoT engineering practice.

### 9.3.1 End-to-End TLS Encryption on the Hardware LAN

**Motivation.** All HTTP communication between the three ESP32 devices and the FastAPI backend currently operates over plaintext HTTP on the local area network. The `X-Hardware-API-Key` header, plate number strings, and gate decision responses are transmitted unencrypted. This was documented as a known limitation during the security review phase (Section 8.7 of the testing chapter). The risk is accepted for the current prototype because the LAN is physically secured within the garage premises; however, it is architecturally unacceptable for any deployment that shares a network with general-purpose devices or operates over an 802.11 wireless medium accessible outside the garage boundary.

**Proposed Solution.** The ESP32 Arduino framework supports TLS client connections through the `WiFiClientSecure` library and the underlying mbedTLS stack. The migration path requires: (1) provisioning a self-signed X.509 certificate on the FastAPI server; (2) embedding the certificate's SHA-256 fingerprint into `hardware_config.h`; and (3) replacing all `HTTPClient` instances with `WiFiClientSecure`-backed equivalents. The `BACKEND_BASE` macro in `hardware_config.h` would change from `http://` to `https://`, and the backend would be configured to accept the same TLS certificate. React WebSocket connections already use `wss:` in production, so the web client requires no changes.

**Estimated impact.** This change eliminates the possibility of man-in-the-middle interception of API keys or plate data on the wireless LAN, upgrading the hardware communication path to the same security standard as the rest of the system.

### 9.3.2 Predictive Maintenance Using Historical IoT Sensor Data

**Motivation.** The current IoT maintenance pipeline is threshold-based: an alert fires the moment a sensor reading crosses a fixed limit. This is superior to reactive maintenance (detecting the failure after it occurs), but it is still fundamentally reactive — the alert is generated only after the value has entered a dangerous range. In real transit fleets, gradual degradation patterns (a slowly falling oil pressure, a brake pad thinning at an accelerating rate) are detectable weeks before the threshold is breached, if the historical trajectory of the sensor is modelled.

**Proposed Solution.** The backend already persists all sensor readings in the `IotSensorReading` table with full temporal resolution. A predictive maintenance service would query this history, apply a regression model — for example, linear or polynomial regression for oil pressure trend, or exponential decay fitting for brake pad thickness — and generate a `MaintenanceRequest` of type `REGULAR` when the projected time-to-threshold falls below a configurable horizon (e.g., seven days). The implementation would add a new APScheduler job, running daily at a low-traffic hour, that materialises predictions for all active vehicles and inserts advisory work orders. For the YOLOv8 crowding model, similar drift detection could flag when the inference accuracy appears to be degrading, prompting a model retraining cycle.

This enhancement transforms the maintenance workflow from alert-driven to forecast-driven, which is the standard in modern enterprise fleet telematics platforms.

### 9.3.3 GPS Hardware Integration and Live Fleet Tracking

**Motivation.** The backend already exposes a fully implemented `POST /api/v1/hardware/gps` endpoint that accepts `{vehicle_id, latitude, longitude, speed, heading}` payloads, persists tracking history in the `GPSTracking` table, and triggers over-speed WebSocket alerts for readings above 80 km/h. The React admin dashboard renders a geographic live network map with route visualisation. However, the Master ESP32 does not currently have a GPS module wired to it, meaning the map displays static route geometry rather than live vehicle positions.

**Proposed Solution.** A UART-based GPS module (Neo-6M or equivalent) should be wired to the Master ESP32's UART2 interface (RX = GPIO16, TX = GPIO17) and parsed using the TinyGPS++ library. The firmware would read NMEA sentences in the background loop, extract latitude, longitude, speed, and heading, and POST to the `/hardware/gps` endpoint at a configurable interval (recommended: every ten seconds). No backend changes are required. This enhancement would complete the live fleet tracking feature, enabling managers to see the real-time position of every vehicle on the live network map, which is a core value proposition of the system.

### 9.3.4 Multi-Garage Cloud Architecture and Horizontal Scaling

**Motivation.** The current deployment is designed for a single garage operating a single FastAPI instance backed by one PostgreSQL database. The Garago data model already includes a `Garage` entity, and every `Driver`, `Vehicle`, and `Route` record carries a `garage_id` foreign key — indicating that the schema was designed with multi-garage operation in mind. As the system is adopted by additional garages, the single-instance architecture will encounter capacity limits in database connection pooling, WebSocket connection management, and CPU time for concurrent OCR requests.

**Proposed Solution.** Horizontal scaling requires three specific changes to the current architecture:

1. **Stateless backend instances behind a load balancer.** The FastAPI application is already largely stateless; the only instance-local state is the OCR reader singleton and the in-process WebSocket `ConnectionManager`. The OCR reader must be moved to a shared service (a dedicated OCR microservice or a model-serving framework such as TorchServe); the WebSocket manager already delegates its pub/sub to Redis, so multiple instances already handle the broadcast correctly without shared in-process state.

2. **Database connection pooling with PgBouncer.** Under high concurrency, asyncpg connections should be pooled through a PgBouncer proxy to prevent connection exhaustion on the PostgreSQL server. The `DATABASE_URL` in the application configuration requires no changes; PgBouncer is transparent to the application layer.

3. **Garage-scoped data partitioning.** The `Garage` model's `garage_id` foreign key should be promoted to a partition key in the `drivers`, `vehicles`, `trips`, and `gate_logs` tables. PostgreSQL 15 declarative range partitioning allows queries scoped to a single garage to avoid full-table scans as row counts grow into the millions.

This roadmap positions Garago as a platform suitable for city-level or regional transit authority deployment, rather than a single-site installation.

---

## 9.4 Closing Remarks

The Smart Bus Garage Management System represents a complete, validated, and production-deployed integration of modern web engineering, mobile development, embedded systems, and applied machine learning. It demonstrates that the problems of manual fleet scheduling, uncontrolled garage access, passenger overcrowding, and reactive maintenance are tractable with today's open-source tooling when approached with a clear architectural separation of concerns: the ESP32 actuates, the edge PC infers, the FastAPI backend coordinates, the PostgreSQL database persists, the Redis layer propagates, the React application oversees, and the Flutter application equips the field.

The system is live, tested, and actively serving registered users. It is the authors' expectation that the future enhancements described in Section 9.3 — TLS encryption on the hardware LAN, predictive IoT maintenance, GPS live tracking, and multi-garage cloud scaling — will be pursued in subsequent phases, progressively elevating Garago from a single-garage automation tool to a comprehensive public transit management platform.

---

## References

[1] S. Ramírez, *FastAPI Documentation*, 2024. Available: https://fastapi.tiangolo.com

[2] The PostgreSQL Global Development Group, *PostgreSQL 15 Documentation*, 2023. Available: https://www.postgresql.org/docs/15/

[3] Redis Ltd., *Redis Pub/Sub Documentation*, 2024. Available: https://redis.io/docs/manual/pubsub/

[4] Google LLC, *Flutter Documentation*, 2024. Available: https://flutter.dev/docs

[5] Ultralytics, *YOLOv8 Documentation*, 2024. Available: https://docs.ultralytics.com

[6] J. H. Baek and S. C. Ahn, "Deep Learning-based License Plate Recognition System," *IEEE Access*, vol. 10, pp. 45701–45712, 2022.

[7] Espressif Systems, *ESP32 Technical Reference Manual*, Version 5.3, 2024. Available: https://www.espressif.com/

[8] OWASP Foundation, *OWASP Top Ten*, 2021. Available: https://owasp.org/www-project-top-ten/

[9] M. Felix Bloc, *flutter_bloc 8.1.6 Documentation*, pub.dev, 2024. Available: https://pub.dev/packages/flutter_bloc

[10] W. Muth, *Dio — HTTP networking package for Dart/Flutter*, pub.dev, 2024. Available: https://pub.dev/packages/dio

[11] APScheduler Contributors, *APScheduler 3.x Documentation*, 2024. Available: https://apscheduler.readthedocs.io

[12] S. Rose, O. Borchert, S. Mitchell, and S. Connelly, "Zero Trust Architecture," NIST Special Publication 800-207, National Institute of Standards and Technology, Aug. 2020.

[13] M. Jones, J. Bradley, and N. Sakimura, "JSON Web Token (JWT)," RFC 7519, Internet Engineering Task Force, May 2015.

[14] I. Fette and A. Melnikov, "The WebSocket Protocol," RFC 6455, Internet Engineering Task Force, Dec. 2011.

[15] SQLAlchemy Contributors, *SQLAlchemy 2.0 Documentation*, 2024. Available: https://docs.sqlalchemy.org/en/20/
