--- (Page Break) ---

# Chapter 6: Communication Protocols

## 6.1 Introduction
Communication protocols are the foundational sets of rules governing data exchange across distributed networks. These specific protocols ensure that profoundly different types of devices—such as an 8-bit sensor, a 32-bit ESP32 microcontroller, a Linux cloud server, and an iOS smartphone—can understand each other for effective, secure communication. They define exact message formats, cryptographic handshake methods, and error-handling mechanisms. This chapter details the various software and hardware protocols utilized across the Garago ecosystem to guarantee sub-second latency and absolute reliability.

## 6.2 HTTP and REST Architecture
The Hypertext Transfer Protocol (HTTP) is the foundational application-layer protocol of the World Wide Web. It operates on a strict, synchronous Request-Response paradigm over an underlying TCP/IP socket.

### 6.2.1 RESTful Principles
Representational State Transfer (REST) is an architectural style used to design network applications. The Garago FastAPI backend exposes over 60 versioned REST endpoints (e.g., `/api/v1/hardware/*`).
*   **Statelessness:** Every HTTP request from a client (React/Flutter/ESP32) must contain all the information necessary for the server to fulfill that request. The backend does not store any session state. Authentication is handled purely via cryptographic JSON Web Tokens (JWT) or API Keys included in the Authorization header.
*   **HTTP Methods:** The system utilizes standard semantic verbs:
    *   **GET:** Used to retrieve resource representations (e.g., fetching the `RotationAssignment` schedule).
    *   **POST:** Used to create new resources (e.g., the ESP32-CAM uploading a new `GateLog` image tensor).
    *   **PATCH:** Used for partial updates (e.g., a driver updating their trip status to `ACTIVE`).

### 6.2.2 The Limitations of HTTP Polling
While HTTP is exceptionally robust, it introduces massive TCP overhead. Every single sensor ping requires a complete TCP three-way handshake, the transmission of bulky HTTP headers (Host, Content-Type, Content-Length), and connection teardown. If the React administrative dashboard relied on HTTP to retrieve live engine temperatures, it would have to send a `GET` request every second (polling). This would rapidly exhaust the backend server's connection pool and CPU.

## 6.3 WebSockets and Full-Duplex Communication
To solve the polling bottleneck, the Garago architecture implements the WebSocket protocol (RFC 6455).

### 6.3.1 The Handshake and Upgrade
WebSockets upgrade a standard HTTP connection into a persistent, full-duplex TCP tunnel. 
1.  The React client sends a standard HTTP `GET` request to the backend with the headers `Upgrade: websocket` and `Connection: Upgrade`.
2.  The FastAPI server authenticates the user's JWT. If valid, it responds with an `HTTP 101 Switching Protocols` status code.
3.  The initial HTTP connection is maintained and upgraded to a raw TCP tunnel.

### 6.3.2 Persistent Framing
Once the tunnel is established, the client and server can stream raw, lightweight frames of data back and forth instantaneously without ever repeating the massive HTTP header overhead. This allows the backend to achieve sub-millisecond latency when broadcasting emergency telemetry alerts to the dashboard.

## 6.4 Redis Publish/Subscribe (Pub/Sub)
Managing thousands of persistent WebSockets on a single Python thread is computationally difficult. To decouple the ingestion of hardware data from the broadcasting of WebSocket alerts, the system utilizes Redis as an in-memory message broker.

### 6.4.1 The Pub/Sub Paradigm
Redis Pub/Sub implements a sender-receiver decoupling pattern.
*   **Publishers:** When an ESP32 node POSTs an overheating engine temperature, the FastAPI ingestion route processes the database write, and then acts as a Publisher. It serializes the alert into a JSON payload and "Publishes" it to a specific Redis topic channel (e.g., `channel:alerts:critical`). The publisher has no knowledge of who is listening.
*   **Subscribers:** A separate background coroutine in the FastAPI server acts as a Subscriber. It constantly monitors `channel:alerts:critical`. The instant a payload arrives in the Redis cache, the Subscriber pulls it and dispatches it to the `ConnectionManager`, which loops through all active WebSockets and pushes the bytes to the authorized managers. 
This broker pattern ensures the system can scale horizontally across multiple Kubernetes pods.

## 6.5 Hardware-Level Protocols
While HTTP and WebSockets govern the cloud, the ESP32 must communicate with its physical sensors using low-level, short-distance electrical protocols.

### 6.5.1 I2C (Inter-Integrated Circuit) Overview
I2C is a two-wire serial communication protocol widely used in embedded systems due to its extreme pin-efficiency. The protocol supports multiple target devices (Slaves) on a single communication bus controlled by a Master. In the Garago system, the ESP32 acts as the Master to drive the 16x2 LCD display.
*   **SDA (Serial Data):** Carries the actual binary data bits.
*   **SCL (Serial Clock):** Generated by the Master, this pin synchronizes the data transfer across all devices.
*   **Addressing:** Communication is sent in byte packets. The master initiates communication by sending a 7-bit hexadecimal address (e.g., `0x27` for the LCD) over the SDA line. Only the specific slave matching that address will respond to the subsequent data bytes, allowing dozens of sensors to share just two GPIO pins.

### 6.5.2 SPI (Serial Peripheral Interface) Overview
The Serial Peripheral Interface (SPI) is a synchronous serial communication protocol used for short-distance, high-speed communication. Unlike I2C which requires device addressing, SPI uses dedicated hardware selection lines.
*   **SCLK (Serial Clock):** The master generates this clock signal for synchronization.
*   **MOSI (Master Out Slave In):** Carries data from the master (ESP32) to the peripheral.
*   **MISO (Master In Slave Out):** Carries data back from the peripheral to the master.
*   **CS/SS (Chip Select / Slave Select):** The master uses this line to select which specific device to talk to. The master pulls the CS line LOW to activate the target device.
*   **Application:** While I2C is used for slow text displays, SPI is utilized for high-bandwidth applications, such as interfacing the ESP32 with its external Flash memory or streaming the OV2640 camera pixel buffers into RAM before network transmission.
