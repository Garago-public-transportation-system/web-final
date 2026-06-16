--- (Page Break) ---

<p align="center">
  <img src="university_logo_placeholder.png" alt="MTI Logo" width="150" /><br/>
  <strong>Modern University for Technology & Information</strong><br/>
  <strong>Faculty of Computers & Artificial Intelligence</strong><br/>
  <strong>Computer Science Department</strong>
</p>

<br/><br/>

<h1 align="center">General Transportation Management System</h1>
<h2 align="center">(Garago: Smart Public Transport Station Management)</h2>

<br/><br/>

<p align="center">
  <em>A graduation project submitted in partial fulfillment of the requirements for the degree of Bachelor of Science in Computer Science</em>
</p>

<br/><br/>

<p align="center">
  <strong>Prepared By:</strong><br/>
  [Student Name 1] - [ID 1]<br/>
  [Student Name 2] - [ID 2]<br/>
  [Student Name 3] - [ID 3]<br/>
  [Student Name 4] - [ID 4]<br/>
  [Student Name 5] - [ID 5]
</p>

<br/>

<p align="center">
  <strong>Supervised By:</strong><br/>
  [Supervisor Name 1]<br/>
  [Supervisor Name 2]
</p>

<br/><br/>

<p align="center">
  <strong>Academic Year</strong><br/>
  2023 / 2024
</p>

--- (Page Break) ---

# Abstract

The rapid urbanization of metropolitan centers has placed an unprecedented strain on public transportation infrastructure. Traditional transit garage management systems rely heavily on fragmented, localized, and largely manual administrative workflows. These antiquated methodologies result in opaque driver scheduling, delayed detection of mechanical failures, uncontrolled passenger crowding, and severe operational inefficiencies, ultimately culminating in phenomena such as "bus bunching." To resolve this crisis, this thesis presents the design, implementation, and rigorous evaluation of the General Transportation Management System (Garago)—a comprehensive, decoupled, three-tier Smart Garage platform that leverages the Internet of Things (IoT), advanced Computer Vision, and highly concurrent asynchronous backend architectures to automate transit dispatch and depot security.

At the physical layer, the system deploys a network of cost-effective Espressif ESP32 microcontrollers equipped with OV2640 optical sensors and HC-SR04 ultrasonic distance sensors. These edge nodes execute non-blocking state machines using FreeRTOS principles to interact with physical access gates and ingest high-frequency telemetric data (engine temperature, oil pressure, brake pad wear, and battery voltage) without latency degradation. Instead of relying on proprietary, vendor-locked hardware, Garago utilizes open-source embedded C++ firmware that communicates over local IPv4 networks via HTTP POST requests, authenticated by constant-time validation of `X-Hardware-API-Key` headers.

The computational core of the architecture is hosted on a high-throughput FastAPI ASGI web server. By leveraging Python's `asyncio` event loops and PostgreSQL 15 via the `asyncpg` SQLAlchemy driver, the backend is capable of processing thousands of concurrent telemetry ingestions while simultaneously serving HTTP clients. A hallmark of this backend is the implementation of an algorithmic "Ping-Pong" scheduler via the Advanced Python Scheduler (`APScheduler`). This engine dynamically allocates a rotating roster of primary, secondary, and standby drivers (D1, D2, D3), utilizing mathematical fatigue-scoring formulas to automatically swap personnel and generate immutable `DriverExchange` audit logs in real-time, effectively eliminating manual dispatch errors.

To address manual ticketing and security bottlenecks, Garago introduces a dual-pipeline AI architecture. At the entry gates, an Automatic Number Plate Recognition (ANPR) subsystem decodes raw JPEG payloads from the ESP32-CAM nodes using EasyOCR (a CRNN and LSTM-based deep learning model), achieving a 94.2% operational accuracy rate in granting gate access under varying lux and occlusion conditions. Concurrently, inside the vehicle cabins, the YOLOv8 object detection model provides continuous passenger headcounts. The backend fuses these visual estimations with cryptographic ticket-validation ratios in a proprietary Dual Crowding Detection algorithm. When cumulative weighted crowding scores exceed the critical 90% threshold, the system bypasses human dispatchers entirely, executing an emergency extra-dispatch routine and broadcasting immediate alerts across the fleet via a Redis Pub/Sub WebSocket architecture.

The presentation layer is bifurcated into two specialized applications: a high-density, React 19 Single Page Application (SPA) utilizing Zustand state management for administrators and operations managers, and a bespoke Flutter mobile application utilizing the BLoC pattern for driver interactions. Exhaustive system evaluations—spanning component unit tests, Hardware-in-the-Loop (HIL) physical validation, and Locust-driven concurrent load tests—demonstrate that the system handles peak production loads with a P95 latency of under 500 milliseconds across all non-vision endpoints. This thesis definitively concludes that the Garago architecture provides a scalable, economically feasible, and technically superior alternative to legacy transit management systems, paving the way for data-driven, autonomous public transportation networks.
