--- (Page Break) ---

# Chapter 2: Background and Literature Review

## 2.1 Introduction
To build a sensitive application related to public safety and municipal infrastructure, such as a real-time transit depot parking system, it is necessary to thoroughly understand the components required to build the project. This ranges from the fundamental hardware parts or devices that form the physical basis of the system, to identifying the necessary software tools and understanding how to employ them optimally. This foundational knowledge adds distinctive, robust features to the system. Therefore, this chapter will discuss the hardware components, software paradigms, and previous academic experiences in building real-time parking and transit systems.

## 2.2 Related Work
An extensive review of existing literature was conducted to benchmark the Garago system against contemporary academic and industrial solutions. The analysis focused on systems leveraging IoT, AI, and edge computing for vehicular management.

### 2.2.1 Analysis of Contemporary Systems

**Table 2-1: Related Work Comparison**

| Title & Year | Authors | Advantages | Disadvantages | Methodology |
| :--- | :--- | :--- | :--- | :--- |
| **Advanced Control Strategies for Automatic Parking Systems in Smart Cities (2023)** | A. Quadri, A. Kumar, T. Sahu, P. Kumar | Automates the toll collection process, reducing manual work and inefficiency. Real-time Parking Availability. Reduces traffic jams. | High Maintenance Costs. The parking depot contains only one gate, creating a severe physical bottleneck and potential collision risk. | The system provides a novel solution for drivers to find available spots utilizing a centralized microcontroller and basic IR sensors. |
| **Sensor Fusion and Path Planning for Autonomous Parking Vehicles (2025)** | A. Al Misbah, M. Al-Hashim, S. Elnakla | The system contains dual IR Sensors for each Gate (Entry and Exit). LCD for displaying empty/full places. Mobile app control. | There are severe security vulnerabilities that occur because of the misuse of the software by the staff (e.g., cloned RFID cards). | The system uses IoT and RFID technology to automate toll collection. An Arduino Mega reads RFID cards, checks the balance via an online server, and actuates the gate. |
| **IoT Based Multi-Level Automatic Parking System (2019)** | P. Kumar, R. Singh | The parking architecture can accommodate significantly more cars than traditional flat-lot parking via mechatronic lifts. | Exceptionally high cost due to the mechanical materials and physical footprint required for the elevators. Wasted time waiting for vertical retrieval. | The system employs mechatronic principles, utilizing Light-Dependent Resistors (LDRs) for slot occupancy, and DC motors controlled by a PIC Microcontroller (PIC18F8722) for vertical/horizontal vehicle movement. |
| **Intelligent Controller Design for a Novel Automatic Parking System (2023)** | F. Youssif, F. Gamil, E.S.A. Bakkar | Real-time Parking Availability. Reduces traffic jams and fuel waste. Web integration. | The web application lacks administrative features. The system does not contain an Alarm System. Relies on single-gate entry causing collisions. | An Arduino Mega 2560 acts as the main controller. It utilizes IR sensors for slot detection and a NodeMCU for basic IoT Wi-Fi connectivity to the web application. |

*Synthesis:* The literature reveals a common deficiency: previous systems rely heavily on easily spoofed RFID tags or basic IR sensors for security, and utilize localized microcontrollers (like the Arduino Mega) that lack the concurrent processing power to handle AI inference. Garago directly addresses these shortcomings by replacing RFID with Deep Learning ANPR, and by migrating heavy computational logic from the edge to an asynchronous FastAPI backend.

## 2.3 Background Microcontroller
A microcontroller is a small computer on a single integrated circuit that is designed to control specific tasks within electronic systems. It combines the functions of a central processing unit (CPU), memory (RAM/ROM), and input/output (I/O) interfaces, all on a single chip. 

Microcontrollers are widely used in embedded systems, such as home appliances, automotive engine control modules, medical devices, and industrial control systems. The programming languages used to write code for microcontrollers vary depending on the manufacturer and the architecture. The most commonly used languages include C, C++, and low-level assembly language. 

### 2.3.1 Types of Microcontrollers
*   **ARM Microcontrollers:** Based on the Advanced RISC Machine (ARM) architecture, these are widely used in high-performance applications, including mobile devices (Cortex-A), automotive systems, and advanced industrial control systems (Cortex-M). They are powerful but often complex to implement for simple gate logic.
*   **PIC Microcontrollers:** Manufactured by Microchip Technology, these Peripheral Interface Controllers (PIC) are commonly used in a wide range of legacy applications, including home appliances and basic smart door locks. They use a proprietary architecture and instruction set.
*   **AVR Microcontrollers:** Manufactured by Atmel Corporation (now Microchip), the AVR architecture powers the famous Arduino Uno (ATmega328P). They are 8-bit controllers excellent for robotics, smart door locks, and consumer electronics due to their simplicity and massive open-source community.
*   **ESP Microcontrollers:** A series of low-cost, low-power systems on a chip (SoC) developed by Espressif Systems. They are uniquely powerful because they integrate native Wi-Fi and Bluetooth silicon directly alongside a 32-bit processor, making them the undisputed standard for modern IoT deployments.

## 2.4 Hardware Components
To achieve the required functionality of the Garago project, the components were chosen based on a strict criterion of affordability, reliability, and network capability.

### 2.4.1 ESP32 Microcontroller
The ESP32-WROOM is a specific module variant within the ESP32 family, designed for Wi-Fi and Bluetooth connectivity in IoT applications. This is a powerful and versatile option featuring a dual-core Xtensa® 32-bit LX6 processor operating at up to 240 MHz (capable of 600 DMIPS). 
**Key Features:**
*   448 KByte ROM and 520 KByte SRAM.
*   Integrated 802.11 b/g/n Wi-Fi and Bluetooth v4.2 BR/EDR & BLE.
*   Abundant peripheral interfaces (SPI, I2C, UART, PWM).
*   It serves as the "Master" node in the Garago gate system, utilizing FreeRTOS to manage concurrent sensor polling and network requests without blocking.

### 2.4.2 ESP32-CAM (OV2640)
The ESP32-CAM is a small size, low power consumption camera module based on the ESP32 development board. It comes equipped with an OV2640 optical camera sensor, and it also features a microSD card slot for local storage. 
In the Garago system, it acts as the primary data acquisition node for the Automatic Number Plate Recognition (ANPR) pipeline. When triggered, it captures a JPEG frame and transmits the byte payload wirelessly via HTTP POST to the backend for AI processing.

### 2.4.3 Servomotor
A servo motor is a rotary or linear actuator designed for precise control of angular position, speed, and acceleration. It operates by receiving a Pulse Width Modulation (PWM) control signal that specifies the desired position, then adjusts its output using internal feedback mechanisms to maintain accuracy. In this project, high-torque servos are utilized to physically raise and lower the entry and exit barriers upon receiving the `GRANTED` authorization signal from the database.

### 2.4.4 Sensors
A sensor is a device that detects physical, chemical, or environmental changes and converts them into electrical signals for analysis.
*   **Ultrasonic Sensor (HC-SR04):** This component emits high-frequency sound waves and calculates the time it takes for the echo to return. It is deployed at the gates to detect the physical presence of a vehicle (proximity sensing), triggering the ESP32-CAM to capture a frame.
*   **Simulated Telemetry Sensors (Potentiometers/IR):** To simulate the internal OBD-II data of a bus (Engine Temperature, Oil Pressure, Brake Pad Wear), the system utilizes analog sensors connected to the ESP32's internal Analog-to-Digital Converter (ADC). The ESP32 maps the voltage variance (0-3.3V) to numerical telemetry values for backend transmission.

### 2.4.5 Liquid-Crystal Display (LCD)
Liquid Crystal Displays (LCDs) are a vital component in embedded systems, providing a user-friendly way to interact with the hardware locally. They display information, menus, and prompts for user input. In the Garago depot, standard 16x2 or 20x4 I2C LCDs are mounted at the gates to provide the driver with immediate visual feedback (e.g., "Scanning Plate...", "Access Granted", "Denied: Maintenance Req"). The I2C interface is critical as it requires only two data wires (SDA and SCL), preserving valuable GPIO pins on the ESP32.

### 2.4.6 Piezo Buzzer and LEDs
*   **Buzzer:** An electronic component that generates sound. It is connected to a digital output and emits an audible tone when the output is pulled HIGH. It provides auditory feedback at the gates (e.g., a short beep for a successful scan, a long continuous alarm if an unauthorized vehicle attempts to force the gate).
*   **Light-Emitting Diodes (LEDs):** LEDs are fundamental components used for Status Indicators. They provide immediate, visible confirmation of the system's internal state (e.g., a Green LED illuminating synchronously with the servo opening, or a Red LED flashing upon network failure).
