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
  <em>Computer Science Graduation Project</em>
</p>
<p align="center">
  <em>Submitted By:</em>
</p>

<br/>

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

# Acknowledgment

Information (M.T.I) for playing a pivotal role in shaping our characters and providing us with all the necessary tools for our educational development. M.T.I. also created a wonderful environment for us to learn throughout our academic years. This accomplishment would not have been possible without the efforts of Prof. Dr. Olfat Kamel, President of M.T.I University, who established such a conducive learning environment, offering the best facilities for our success. 

It is a pleasure to thank Prof. Dr. Mohamed Taher El-Mayah, Dean of the Faculty of Computers & Artificial Intelligence, and Prof. Dr. Mohamed Mohamed Elgazzar, Vice Dean for Academic Affairs, for their unlimited help, support, encouragement, and guidance. We are honored to have worked under the supervision of our advisors, who have been both mentors and guides. We owe them a great deal for their advice and support, as well as for providing the necessary information regarding the project and following up with us through every stage until completion. 

It was also a pleasure to work with our Teaching Assistants who guided us through the learning process, never accepting less than our best efforts. We express our heartfelt thanks to them for their dedication and encouragement. Special thanks to the head of the Computer Science Department, as well as the department staff, for their efforts during our university studies. A special thank you to the heads of the Information System and Artificial Intelligence Departments, for their ongoing support throughout our academic journey. 

We would like to thank the head of the Basic Science Department and her staff, for their role in providing the foundational knowledge for our computer science degree. Special thanks go to the head of the IT Center, for their efforts in imparting essential knowledge for our computer science degree. We are grateful to all the Assistant Lecturers and Teaching Assistants who helped us throughout our studies with practical demonstrations that deepened our understanding and provided valuable hands-on experience. 

Special thanks and gratitude to our families for their unwavering support throughout our academic journey. Their consistent encouragement has been invaluable, and we recognize that our accomplishments would not have been possible without their presence and assistance.

--- (Page Break) ---

# Abstract

The increasing economic activities in metropolitan areas have resulted in a significant rise in vehicular traffic, leading to the pressing issue of traffic congestion and inefficient public transport depot management. One of the major challenges faced by transit authorities in these bustling cities is the scarcity of optimized driver scheduling, the lack of real-time telemetry for vehicle maintenance, and the inability to automatically detect passenger crowding levels, particularly during peak hours. The lack of centralized knowledge regarding the operational status of the fleet at any given time further exacerbates this problem, leading to systemic failures such as "bus bunching." To address these challenges, this documentation presents an innovative solution: an automated and smart transportation management system named Garago.

The proposed automated transit system aims to alleviate metropolitan traffic congestion by providing an efficient, decoupled, and user-friendly management experience. By utilizing advanced sensor arrays—including ESP32-CAM modules for Optical Character Recognition (OCR), HC-SR04 ultrasonic sensors for vehicle detection, and analog sensors for engine telemetry—the system remotely communicates the real-time status of physical assets to a highly concurrent FastAPI backend. This information is then fused with YOLOv8 artificial intelligence models to predict crowding and dynamically allocate drivers using an automated "Ping-Pong" scheduling algorithm.

The ESP32 microcontroller is responsible for managing the physical entry and exit gates. It acts as the edge node, gathering telemetry and transmitting it over Wi-Fi to the core application servers. Backend development incorporated the initialization and configuration of a PostgreSQL relational database and Redis Pub/Sub WebSockets, ensuring seamless, sub-second communication between the mobile applications (developed in native Android/Flutter for drivers) and the React-based administrative dashboards. 

System testing was carried out to verify the functionality and reliability of the hardware features, mobile applications, and their AI interactions under concurrent load. Key functionalities of the system include automatic vehicle plate recognition, dynamic database updates, real-time user WebSocket notifications, and spatial occupancy tracking. By integrating ESP32 sensor control with cutting-edge computer vision (EasyOCR and YOLO), this project offers an affordable, scalable solution to streamline transit operations, reduce idle emissions, and enhance urban mobility convenience.

--- (Page Break) ---

# List of Abbreviations

| Abbreviation | Full Term |
| :--- | :--- |
| **ADC** | Analog-to-Digital Converter |
| **AI** | Artificial Intelligence |
| **ANPR** | Automatic Number Plate Recognition |
| **API** | Application Programming Interface |
| **ASGI** | Asynchronous Server Gateway Interface |
| **BLoC** | Business Logic Component (Flutter state management) |
| **CI/CD** | Continuous Integration / Continuous Deployment |
| **CNN** | Convolutional Neural Network |
| **CORS** | Cross-Origin Resource Sharing |
| **CRNN** | Convolutional Recurrent Neural Network |
| **CTC** | Connectionist Temporal Classification |
| **DAST** | Dynamic Application Security Testing |
| **DC** | Direct Current |
| **ESP32** | Espressif Systems 32-bit Microcontroller |
| **FLOPs** | Floating Point Operations Per Second |
| **FPN** | Feature Pyramid Network |
| **GPIO** | General-Purpose Input/Output |
| **HIL** | Hardware-in-the-Loop |
| **HTTP** | Hypertext Transfer Protocol |
| **I2C** | Inter-Integrated Circuit |
| **IDE** | Integrated Development Environment |
| **IoT** | Internet of Things |
| **IR** | Infrared |
| **JWT** | JSON Web Token |
| **LAN** | Local Area Network |
| **LCD** | Liquid Crystal Display |
| **LSTM** | Long Short-Term Memory |
| **mAP** | Mean Average Precision |
| **MISO** | Master In Slave Out (SPI) |
| **MOSI** | Master Out Slave In (SPI) |
| **NFC** | Near Field Communication |
| **NMS** | Non-Maximum Suppression |
| **NVS** | Non-Volatile Storage |
| **OBD** | On-Board Diagnostics |
| **OCR** | Optical Character Recognition |
| **ORM** | Object-Relational Mapper |
| **PANet** | Path Aggregation Network |
| **PCB** | Printed Circuit Board |
| **PWM** | Pulse Width Modulation |
| **RBAC** | Role-Based Access Control |
| **RDBMS** | Relational Database Management System |
| **REST** | Representational State Transfer |
| **RFID** | Radio-Frequency Identification |
| **RNN** | Recurrent Neural Network |
| **SBC** | Single Board Computer |
| **SCL** | Serial Clock (I2C) |
| **SCLK** | Serial Clock (SPI) |
| **SDA** | Serial Data (I2C) |
| **SPA** | Single Page Application |
| **SPI** | Serial Peripheral Interface |
| **SQL** | Structured Query Language |
| **SRS** | Software Requirements Specification |
| **SSL / TLS**| Secure Sockets Layer / Transport Layer Security |
| **TCP/IP** | Transmission Control Protocol / Internet Protocol |
| **UART** | Universal Asynchronous Receiver-Transmitter |
| **UML** | Unified Modeling Language |
| **VIN** | Vehicle Identification Number |
| **WS** | WebSocket |
| **XSS** | Cross-Site Scripting |
| **YOLO** | You Only Look Once |
