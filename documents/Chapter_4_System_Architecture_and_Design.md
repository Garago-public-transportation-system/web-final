--- (Page Break) ---

# Chapter 4: System Design and Hardware Integration

## 4.1 Introduction
This chapter delves into the practical construction of the Garago smart parking and transit management system, building on the basic principles established previously. It explains the step-by-step wiring process and explores the system architecture. This section focuses heavily on the hardware integration of the parking infrastructure itself, detailing how the hardware components such as the parking barriers, ultrasonic vehicle detection sensors, and the ESP32-CAM license plate recognition technology wire together. Finally, this chapter explains the software tools used for programming the embedded systems, configuring the relational databases, and developing the user interfaces.

## 4.2 Hardware Integration
To achieve the required functionality of this project, the physical components must be wired precisely to the ESP32 GPIO pins. The ESP32 operates on 3.3V logic, meaning that interfacing with 5V components (like standard servos or LCDs) requires careful power management and logic-level shifting.

### 4.2.1 Liquid-Crystal Display (I2C 16x2)
An LCD display is a crucial part of the gate solution since it can show visual feedback directly to the driver without requiring a mobile application. The 16x2 I2C LCD is a great way to display "Granted" or "Denied" statuses. 

**Components:**
*   LCD 16x2 with I2C Backpack module.
*   ESP32-WROOM-32.
*   Female-to-Female Jumper wires.

**Wiring Steps:**
To wire the I2C LCD screen to the ESP32 board, connect the following pins:
*   Connect the **GND** pin of the LCD to any **GND** pin on the ESP32.
*   Connect the **VCC** pin of the LCD to the **VIN (5V)** pin on the ESP32 (Ensure the ESP32 is powered via USB 5V).
*   Connect the **SDA (Serial Data)** pin of the LCD to digital **GPIO 21** on the ESP32.
*   Connect the **SCL (Serial Clock)** pin of the LCD to digital **GPIO 22** on the ESP32.

**LCD Working Algorithm:**
1.  **START**
2.  **Initialize:** Define the I2C address (usually `0x27`) and dimensions (16 columns, 2 rows).
3.  **Display Initial Message:** Print "Garago System / Ready" on the LCD upon boot.
4.  **Wait for Event:** The ESP32 polls the ultrasonic sensor.
5.  **Process Data:** If the backend returns `GRANTED`, format the string.
6.  **Display Output:** Use the `lcd.setCursor(0,0)` and `lcd.print("Access Granted")` functions.
7.  **Delay:** Include a 4,000ms delay to allow the driver to read the message.
8.  **Clear:** Use `lcd.clear()` and loop back to step 3.
9.  **END**

### 4.2.2 HC-SR04 Ultrasonic Sensor
The ultrasonic sensor is used for detecting physical proximity. It emits a 40kHz sound wave and measures the time it takes for the echo to bounce off a vehicle. It operates at 5V, meaning its `Echo` pin output must be reduced via a voltage divider before hitting the 3.3V ESP32 GPIO to prevent silicon damage.

**Components:**
*   HC-SR04 Ultrasonic Sensor.
*   ESP32-WROOM-32.
*   1k Ohm and 2k Ohm resistors.

**Wiring Steps:**
*   Connect the **VCC** pin of the sensor to the **VIN (5V)** pin of the ESP32.
*   Connect the **GND** pin of the sensor to the **GND** pin of the ESP32.
*   Connect the **Trig** pin to digital **GPIO 5** on the ESP32.
*   Connect the **Echo** pin to a voltage divider (1k resistor in series, 2k resistor to ground). Connect the junction to **GPIO 18** on the ESP32.

**Ultrasonic Working Algorithm:**
1.  **START**
2.  **Initialize:** Set `Trig` as OUTPUT and `Echo` as INPUT.
3.  **Trigger Wave:** Pull `Trig` LOW for 2µs, then HIGH for 10µs, then LOW.
4.  **Read Echo:** Use the `pulseIn()` function to read the duration the `Echo` pin stays HIGH.
5.  **Calculate Distance:** Distance (cm) = (Duration / 2) * 0.0343.
6.  **Check Threshold:** If Distance < 15cm, trigger the ESP32-CAM to take a photo.

### 4.2.3 SG90 Servomotor
The servo motor in the gates of the smart parking system is an electromechanical actuator that precisely controls the physical barrier. It receives a 50Hz PWM signal from the ESP32.

**Wiring Steps:**
*   Connect the **Brown** (Ground) wire to **GND**.
*   Connect the **Red** (Power) wire to an external 5V power supply (Servos draw too much current to be powered directly from the ESP32 pins).
*   Connect the **Orange** (Signal) wire to **GPIO 13** on the ESP32.

**Servo Motor Working Algorithm:**
1.  **START**
2.  **Initialize:** Include the `ESP32Servo` library and attach the object to pin 13.
3.  **Set Idle State:** Use `servo.write(0)` to lower the barrier.
4.  **Receive Command:** If the backend responds with HTTP 200 OK.
5.  **Actuate:** Use `servo.write(90)` to open the gate to a 90-degree angle.

### 4.2.4 Active Piezo Buzzer
The buzzer provides auditory feedback. It emits a loud beep when pulled HIGH.

**Wiring Steps:**
*   Connect the **Negative (-)** short leg of the buzzer to **GND**.
*   Connect the **Positive (+)** long leg to **GPIO 14** via a 100-ohm current-limiting resistor.

**Buzzer Working Algorithm:**
1.  **START**
2.  **Check State:** If the OCR confidence is low, or the vehicle is unauthorized.
3.  **Alarm:** `digitalWrite(14, HIGH)` for 1,000ms.
4.  **Silence:** `digitalWrite(14, LOW)`.

## 4.3 Software Tools Used

### 4.3.1 Visual Studio Code (VS Code)
Visual Studio Code is a free, lightweight yet powerful source code editor developed by Microsoft. It is the primary IDE used for the entire software stack of the Garago platform (Python Backend, React Web, and Flutter Mobile). It offers intelligent code completion (IntelliSense), an integrated terminal, and seamless Git integration. Its vast extension marketplace allowed the team to install Python formatting tools (Black/Ruff), Docker integration, and Flutter Dart syntax highlighting within a unified workspace.

### 4.3.2 Arduino IDE (C++ Firmware)
The Arduino IDE (Integrated Development Environment) is a software platform specifically designed for programming microcontrollers. While originally built for 8-bit AVR boards, it supports the 32-bit ESP32 via the Board Manager. It provides a simple code editor, a C++ compiler (xtensa-esp32-elf-g++), and a serial monitor tool that allows developers to interact with the ESP32 via USB to debug HTTP connection statuses and memory heap allocation.

### 4.3.3 pgAdmin 4 (Database Management)
pgAdmin is the most popular and feature-rich open-source administration and development platform for PostgreSQL. It was used extensively during the system design phase to visually execute SQL queries, inspect the 22 table schemas generated by SQLAlchemy Alembic migrations, and verify that the `RotationAssignment` constraints and Foreign Key cascading rules were executing correctly.

### 4.3.4 Postman (API Testing)
Postman is an API platform for building and using APIs. Before integrating the complex Flutter and React frontends, the backend logic was rigorously tested using Postman. The team created extensive Collections to simulate ESP32 hardware HTTP POST requests, verify the injection of the `X-Hardware-API-Key` headers, and test the JSON Web Token (JWT) authentication flow for the Manager endpoints.

### 4.3.5 Docker
Docker is a set of platform-as-a-service products that use OS-level virtualization to deliver software in packages called containers. Docker was utilized to guarantee that the FastAPI backend, the PostgreSQL database, and the Redis cache all ran in identical, isolated environments regardless of whether the code was executing on a developer's macOS laptop or the production Linux server. This completely eradicated the "it works on my machine" development paradigm.
