--- (Page Break) ---

# Chapter 3: System Planning and Analysis

## 3.1 Introduction
This chapter emphasizes the critical role of meticulous planning in building a smart and reliable automated transportation management system. Recognizing the importance of user safety, system reliability, and database scalability, this chapter presents the project's strategic roadmap. The project plan goes deep into the process of breaking down the project into manageable tasks, enhancing efficient distribution among team members. Furthermore, the chapter outlines the creation of a project timeline, ensuring a well-defined schedule for full-stack development. It sheds light on the basic Unified Modeling Language (UML) architectures of the system. By emphasizing the importance of planning, this chapter lays the foundation for a successful and efficient smart parking and dispatch development process.

## 3.2 Tasks Management and Team Collaboration
This section highlights the importance of teamwork in constructing a reliable smart transportation system. Recognizing the value of collaboration across disparate disciplines (Embedded C++, Python Backend, Deep Learning, and Frontend UI), it outlines the project team structure, comprised of specialized individuals. By fostering a collaborative environment and leveraging diverse skill sets, this approach optimized the Garago development process and ensured project success.

### 3.2.1 Team Members and Roles
1.  **[Student Name 1]** - Lead Systems Architect & AI Integration
2.  **[Student Name 2]** - Backend Python Developer (FastAPI & PostgreSQL)
3.  **[Student Name 3]** - Embedded Hardware Engineer (ESP32 C++)
4.  **[Student Name 4]** - Mobile Application Developer (Flutter BLoC)
5.  **[Student Name 5]** - Frontend Web Developer (React SPA & WebSockets)

### 3.2.2 Task Definition Breakdown
The following table provides a comprehensive breakdown of the team roles and the specific development lifecycle phases involved in building the Garago platform.

**Table 3-1: Development Lifecycle Task Definition**
| Development Life Cycle Phase | Students Participating |
| :--- | :--- |
| **Problem Definition & Literature Survey** | All Members |
| **System Analysis:**<br/>• Collect Operational Data<br/>• Define Software and Hardware Simulator requirements. | All Members |
| **Identify Application Architecture:**<br/>• Design React and Flutter App UI.<br/>• Map Signal Flow and WebSocket routing.<br/>• Study the required React and Dart frameworks. | [Student Name 4], [Student Name 5], [Student Name 2] |
| **Identify Hardware Components:**<br/>• Draw Prototype Circuit Diagrams for ESP32 and Sensors.<br/>• Study the Required C++ FreeRTOS libraries. | [Student Name 3], [Student Name 1] |
| **Identify The AI Model Architecture:**<br/>• Collect/Annotate License Plate Dataset.<br/>• Study YOLOv8 and EasyOCR architectures.<br/>• Train and fine-tune models. | [Student Name 1], [Student Name 2] |
| **System Implementation (Hardware):**<br/>• Solder components, wire sensors to ESP32.<br/>• Program `millis()` non-blocking loops. | [Student Name 3] |
| **System Implementation (Software):**<br/>• Code FastAPI backend, configure PostgreSQL schemas.<br/>• Implement React Web and Flutter mobile logic. | [Student Name 2], [Student Name 4], [Student Name 5] |
| **System Testing:**<br/>• Hardware-in-the-Loop tests, Locust Load Testing, Unit Testing. | All Members |
| **System Documentation & Presentation:**<br/>• Compile the B.Sc. thesis, format IEEE references, and prepare defense. | All Members |

## 3.3 Project Scheduling and Timeline
To ensure the timely delivery of the complete Garago platform, the development lifecycle was mapped against a strict temporal schedule. 

### 3.3.1 Task Duration (Gantt Chart Representation)
A Gantt chart is a popular project management tool used to show activities (tasks or events) displayed against time. Each activity is represented by a bar; the position and length of the bar reflect the start date, duration, and end date of the activity. 
For the Garago project, the timeline was structured across a massive 6-month development cycle:
1.  **Month 1 (Research & Analysis):** Finalizing the problem statement, conducting the literature review on EasyOCR and ESP32 capabilities, and drafting the initial Software Requirements Specification (SRS).
2.  **Month 2 (Architecture Design):** Generating the UML diagrams, designing the PostgreSQL Entity Relationship Diagram (ERD), and mapping the ESP32 GPIO pinouts.
3.  **Month 3 (Hardware Prototyping):** Assembling the physical gates, writing the C++ firmware for the Master ESP32 and the ESP32-CAM, and testing basic local Wi-Fi connectivity.
4.  **Month 4 (Backend & AI Development):** Constructing the FastAPI server, setting up the `APScheduler` Ping-Pong algorithm, and fine-tuning the YOLOv8 and EasyOCR models on custom datasets.
5.  **Month 5 (Frontend Integration):** Developing the React web dashboard and the Flutter mobile application, integrating Axios/Dio HTTP clients, and establishing Redis Pub/Sub WebSocket tunnels to the backend.
6.  **Month 6 (Testing & Documentation):** Executing exhaustive HIL integration tests, running Locust performance benchmarks, fixing critical bugs, and finalizing this thesis document.

## 3.4 System Analysis (UML Diagrams)
System analysis is a problem-solving technique that improves the system and ensures that all components work efficiently to accomplish their purpose. By identifying potential structural issues or logic inefficiencies in the design phase, a thorough system analysis optimized the final performance of the Garago platform. The architecture is represented through various Unified Modeling Language (UML) perspectives.

### 3.4.1 Network Diagram
The Network Diagram illustrates the physical and logical topology of the system. 
*   **The Edge:** The depot contains multiple ESP32 and ESP32-CAM nodes connected via a 2.4GHz Wi-Fi LAN router. 
*   **The Bridge:** The router interfaces with the public internet via a NAT firewall.
*   **The Core:** The cloud infrastructure hosts the FastAPI server, the PostgreSQL 15 database instance, and the Redis in-memory cache.
*   **The Clients:** Dispatcher PCs and Driver Android smartphones connect to the cloud infrastructure via standard 4G/LTE or broadband connections.

### 3.4.2 System Block Diagram
The System Block Diagram illustrates the major hardware and software components and their interactions at a high level. 
It shows the `Sensors` (Ultrasonic, Voltage, Temperature) feeding analog/digital signals into the `ESP32 Microcontroller`. The Microcontroller outputs PWM signals to the `Servo Motor` and `Buzzer`, while simultaneously sending HTTP payloads to the `FastAPI Server`. The Server interacts bilaterally with the `Database` and pushes state to the `Web/Mobile Apps`.

### 3.4.3 Context Diagram (Level 0 DFD)
The Context Diagram (Data Flow Diagram Level 0) focuses on the system's interactions with external entities, establishing the scope of the project.
*   **Central Node:** The Garago Backend System.
*   **Entity 1 (Driver):** Inputs check-in data and trip state changes. Receives schedule assignments.
*   **Entity 2 (Manager):** Inputs configuration data and approvals. Receives real-time dashboard alerts.
*   **Entity 3 (Hardware Gate):** Inputs OCR images and telemetry. Receives `GRANTED` or `DENIED` actuation commands.

### 3.4.4 State Machine Diagram (Gate Actuation)
The state machine diagram depicts the system's behavioral logic, specifically the physical gate control.
*   **State 1: IDLE:** The ESP32 is polling the ultrasonic sensor.
*   **State 2: DETECTED:** Ultrasonic distance $< 10$cm. State transitions. Trigger ESP32-CAM.
*   **State 3: PROCESSING:** ESP32-CAM transmits JPEG. Backend runs EasyOCR.
*   **State 4: ACTUATION:** If Backend returns `GRANTED`, state transitions to Gate Open. Servo rotates to 90 degrees.
*   **State 5: HOLDING:** Gate remains open for a non-blocking 4,000ms delay.
*   **State 6: CLOSING:** Servo returns to 0 degrees. Transition back to `IDLE`.

### 3.4.5 Sequence Diagram (Trip Initiation)
The sequence diagram illustrates the chronological interactions between a User and the System.
1.  **Driver (Flutter App)** taps "Start Trip".
2.  **App** sends `POST /api/v1/trips/{id}/start` (with JWT) to **FastAPI Backend**.
3.  **Backend** validates JWT via middleware.
4.  **Backend** queries **PostgreSQL Database** to ensure the trip is `SCHEDULED` and time is valid.
5.  **Database** confirms. **Backend** updates trip status to `ACTIVE`.
6.  **Backend** publishes an alert to **Redis**.
7.  **Redis** broadcasts over WebSocket to **React Dashboard**.
8.  **Backend** returns HTTP 200 OK to **Flutter App**.
9.  **App** UI updates the button to "End Trip".

### 3.4.6 Use Case Diagram
The Use Case diagram provides a high-level overview of system functionalities mapped to specific actors.
*   **Admin Actor:** Can Create/Delete Users, Modify Routes, Configure Depot settings.
*   **Manager Actor:** Can View Live Dashboard, Approve Maintenance, View Gate Logs, Trigger Emergency Dispatch.
*   **Driver Actor:** Can Login, Check-in for Shift, Start/End Trips, Submit Maintenance Faults.
*   **Edge Node Actor:** Can Submit OCR Images, Submit IoT Telemetry, Receive Actuation Commands.
