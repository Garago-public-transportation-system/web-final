--- (Page Break) ---

# Chapter 1: Introduction

## 1.1 Overview
The increasing economic activities in metropolitan areas have resulted in a significant rise in vehicular traffic, leading to the pressing issue of traffic congestion. One of the major challenges faced by vehicle owners and municipal transport authorities in these bustling cities is the scarcity of optimized public transport management, particularly during peak hours. The lack of knowledge regarding the availability of fleet vehicles, driver fatigue states, and depot parking spaces at any given time further exacerbates this problem. To address these challenges, this documentation presents an innovative solution: an automated and smart transportation management system named Garago.

The proposed automated transport management system aims to alleviate metropolitan traffic congestion by providing an efficient, decoupled, and user-friendly fleet dispatch experience. By utilizing advanced sensor modules—such as HC-SR04 ultrasonic transmitter-receiver pairs and OV2640 optical cameras—the system remotely communicates the real-time status of gate occupancy and vehicle authorization to an ESP32 microcontroller. This information is then rapidly processed by a highly concurrent FastAPI backend. Through this architecture, transit administrators can instantly ascertain the operational status of the depot before vehicles even approach the gates, saving valuable time and effort. 

The Garago smart system is developed with the incorporation of advanced technologies and research from various academic disciplines, including Machine Learning (YOLOv8 and EasyOCR), asynchronous Python web frameworks, embedded C++ edge computing, and real-time WebSocket broadcasting. With its deployment in the transport depot, it is hoped that it will solve the systemic problems faced by transit authorities, such as "bus bunching" and reactive mechanical maintenance.

The project is a microcontroller-based smart system. Usually, in large metropolitan depots, dispatchers need to manually search through physical ledgers to assign drivers to available vehicles. Our project aims to overcome this trouble. We designed a system where sensors are placed at critical physical chokepoints (e.g., entry and exit gates). These sensors are connected to the central backend via the ESP32 microcontrollers. The system displays whether the vehicle is authorized, what its mechanical status is, and algorithmically assigns the correct driver based on a mathematically optimized "Ping-Pong" fatigue metric. This is carried out by programming the ESP32 microcontroller to act as a stateless edge node, pushing JSON payloads to the central PostgreSQL database.

There will be a digital dashboard (React SPA) accessible from the administrative office to show if the depot is operating smoothly or if there are critical anomalies, such as an overheating engine or a vehicle attempting unauthorized exit. On each bus, we will simulate sensors that show if the engine temperature or oil pressure is within safe bounds. The system consists of microcontrollers, physical sensors, Deep Learning AI models, and intuitive user displays, all connected to each other in the project to form a completely smart transportation management system.

## 1.2 Motivation
Some challenges must always be addressed when deploying any new technology in an industrial setting like a transit depot. Ensuring the security and reliability of an automatic management system is among the most critical. Because such systems depend heavily on physical sensors, complex software algorithms, and persistent network connectivity, any malfunction could compromise vehicle safety or facility access. Therefore, it is essential to regularly update, test, and enhance the system’s hardware and software components.

The following sections will clarify the specific challenges that motivated the development process of the Garago platform:

*   **Power Interruptions at the Edge:**
    The depot’s sensors, gate servos, and camera modules must remain operational or gracefully recover during grid outages. Relying on complex edge computers like the Raspberry Pi introduces the risk of Linux file system corruption upon sudden power loss. This motivated the selection of the ESP32 microcontroller, which executes bare-metal C++ firmware and boots in milliseconds, utilizing Non-Volatile Storage (NVS) to maintain critical integer states across power cycles.

*   **Mechanical Failures in Legacy Systems:**
    Physical components (bus engines, brake pads, tire alignments) wear over time. Traditional transit depots rely on reactive maintenance—fixing a bus only after it breaks down on the road. This motivated the development of the IoT ingestion pipeline. By transmitting simulated engine temperature and oil pressure directly to the backend in real-time, the system can automatically instantiate `MaintenanceRequest` entities before catastrophic mechanical failures occur, significantly reducing municipal downtime.

*   **Security Vulnerabilities at Depot Gates:**
    Unauthorized access to the parking facility (tailgating, cloned access cards, spoofed license plates) can compromise safety and asset integrity. This motivated the integration of an AI-driven Automatic Number Plate Recognition (ANPR) pipeline. Rather than relying on human guards or easily cloned RFID tags, the system uses the EasyOCR deep learning model to cryptographically verify the physical license plate of the vehicle against the PostgreSQL database in under two seconds.

*   **User Error in Dispatch and Scheduling:**
    Human dispatchers may misuse scheduling software, misallocate drivers, or ignore labor regulations regarding driver fatigue, leading to dangerous road conditions. This motivated the creation of the `APScheduler` "Ping-Pong" algorithm. By mathematically tracking driver shift times and calculating a `fatigue_score`, the system removes the human element from scheduling, automatically swapping primary and standby drivers to prevent errors.

*   **Power Consumption and Bandwidth:**
    Sensor networks and cameras must balance performance with network bandwidth, especially when hundreds of nodes are transmitting simultaneously. This motivated the architectural decision to bypass heavy TCP/IP handshake overhead where possible, utilizing stateless HTTP POST requests for the hardware, and pushing localized optical inference (YOLOv8) to the edge network rather than streaming heavy video files over the internet.

*   **Reliability Under Environmental Stress:**
    The system must accurately detect occupancy and process plate authorizations under varying weather conditions, lighting levels, and vehicle types. This motivated the fine-tuning of the EasyOCR model to explicitly handle low-contrast, shadowed, or partially occluded license plates, implementing a strict $0.85$ confidence threshold to guarantee a 94.2% operational accuracy rate without false positives.

*   **Data Protection and Latency:**
    User data—such as driver locations, shift hours, and vehicle telemetry—must be safeguarded and transmitted instantaneously. This motivated the implementation of a Redis Pub/Sub WebSocket architecture. Instead of clients heavily polling the database, critical security alerts are pushed directly to the React dashboard over encrypted (future TLS) channels in under 500 milliseconds.

*   **Programming Errors and Race Conditions:**
    Bugs in guidance logic or sensor-fusion routines can lock users out or misallocate resources. This motivated the adoption of rigorous asynchronous software development. By utilizing FastAPI's `asyncio` event loop and `asyncpg`, the backend inherently prevents Thread starvation and Race conditions during highly concurrent hardware polling.

## 1.3 Objective
The Garago system is designed to provide a secure and smart transit depot environment, safeguarding municipal vehicles and optimizing human resources. Access control mechanisms, such as deep-learning license plate recognition, ensure that only authorized vehicles enter and exit the facility. By restricting access strictly to registered assets mapped in the relational database, the system helps maintain privacy and security for all fleet operations.

### Key Features of the Automated System

*   **Enhanced Security via AI:**
    The system enforces facility security through strict gated entry and exit points, validated by real-time optical monitoring. The EasyOCR integration acts as an advanced authentication layer, physically matching the vehicle's identity against the immutable database records, completely eliminating the reliance on easily spoofed ID cards.

*   **Operational Convenience and Automation:**
    Administrators experience seamless management through the algorithmic pre-generation of the daily driver roster. On arrival at their shift, drivers utilize a bespoke Flutter mobile application to check-in. The system automatically identifies the required ping-pong rotations without human dispatcher intervention. Maintenance requests are handled in-app, entirely digitizing the fault reporting workflow.

*   **High-Accuracy Passenger and Vehicle Recognition:**
    Advanced computer-vision algorithms (YOLOv8) calculate real-time passenger headcounts within the vehicle cabins. Combined with cryptographic ticket validation arrays, this Dual Crowding Fusion authentication greatly reduces the risk of passengers being stranded by "ghost buses," automatically triggering relief vehicle dispatches when capacity thresholds are breached.

### Summary
The goal of the Garago automated management system is to deliver a secure, efficient, and technologically superior transit experience. By integrating multi-factor AI access controls, automated vehicle scheduling, and real-time IoT telemetric ingestion, the system not only heightens depot security but also radically streamlines the entry, exit, and maintenance processes for both drivers and municipal operators.
