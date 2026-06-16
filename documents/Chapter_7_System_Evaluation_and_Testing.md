--- (Page Break) ---

# Chapter 7: System Evaluation & Testing

## 7.1 Introduction
After completing the construction of the project, it is essential to ensure that the platform is running efficiently and that there are no latent logic errors that can cause danger, especially when it comes to municipal fleet safety and gate security. Physical gate actuation and deep-learning plate recognition are among the most delicate and complex matters to deal with. Section 7.2 presents comprehensive system test scenarios and details how the system behaved under rigorous QA parameters.

## 7.2 Test Case Points
To document the evaluation strategy, tests are broken down into specific definitions:
*   **Index:** A unique identifier for the test case.
*   **Test Name:** It is a description of the feature based on which it is tested to find out whether it works or not.
*   **Test Case:** The specific scenario being validated.
*   **Precondition:** What must exist in the database or hardware before the test begins.
*   **Test Steps:** A detailed list of actions the tester needs to perform to execute the test.
*   **Test Data:** The actual inputs provided.
*   **Output:** The outcome observed when the test is executed.

This document outlines various testing scenarios to comprehensively evaluate the functionality, security, and performance of the automated transit system. The testing scenarios are shown as test cases in Table 7-1.

**Table 7-1: Comprehensive System Testing Matrix**

| Index | Test Name | Test Case | Precondition | Test Steps | Test Data | Output |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `Login_1` | Verification of mobile app login page with valid driver credentials. | Driver ID and password need to match a record in PostgreSQL `users` table. | 1) Type correct username.<br>2) Type correct password.<br>3) Press login button. | 1) valid username.<br>2) valid password.<br>3) button click. | **Login successful.** Flutter routes to Dashboard. |
| **2** | `Login_2` | Verification of login page with invalid username and valid Password. | Driver ID and password need to match for login. | 1) Type incorrect username.<br>2) Type correct password.<br>3) Press login button. | 1) invalid username.<br>2) valid password.<br>3) button click. | **Error:** This username you entered is incorrect. HTTP 401. |
| **3** | `Login_3` | Verification of admin web portal with SQL Injection attempt. | Sanitization Middleware must be active on FastAPI. | 1) Type valid username.<br>2) Type SQL injection script in password field.<br>3) Press login. | 1) valid username.<br>2) `' OR '1'='1` | **Error:** Malicious string sanitized. Login Denied. |
| **4** | `Schedule_1` | Verification of the Ping-Pong APScheduler Cron Job. | The time must be 05:30 AM UTC. Vehicles must be `FREE`. | 1) Advance server clock to 05:30 AM.<br>2) Monitor logs for execution.<br>3) Query DB. | 1) Server Time mutation.<br>2) PostgreSQL `SELECT`. | **Execution successful.** 3 Drivers assigned per Route. |
| **5** | `Schedule_2` | Verification of Fatigue Swap mechanism. | Primary driver must have a `fatigue_score` > 80. | 1) Artificially inflate driver fatigue score.<br>2) Wait for 5-minute polling interval.<br>3) Check DB. | 1) `UPDATE drivers SET fatigue_score = 85.0`<br>2) Wait 5m. | **Swap successful.** Primary driver moved `ON_BREAK`. Standby moved `ACTIVE`. |
| **6** | `Gate_1` | Verification of physical ultrasonic gate trigger. | Vehicle plate is registered and Status is `EN_ROUTE`. | 1) Move hand physically in front of HC-SR04 sensor.<br>2) Monitor ESP32 serial output. | 1) Object < 10cm distance. | **Hardware trigger successful.** ESP32-CAM fires image POST. |
| **7** | `OCR_1` | Verification of EasyOCR pipeline with perfect image. | Camera must capture a clear, well-lit JPEG. | 1) Trigger ESP32-CAM in daylight.<br>2) Monitor FastAPI terminal.<br>3) Observe Servo. | 1) Clean Plate image tensor. | **Recognition successful.** DB Match. Backend returns `GRANTED`. Servo rotates 90 degrees. |
| **8** | `OCR_2` | Verification of EasyOCR pipeline with occluded image. | Camera captures a plate covered in dirt/mud. | 1) Obscure physical plate.<br>2) Trigger sensor.<br>3) Monitor terminal. | 1) Occluded Plate image tensor. | **Rejection successful.** Confidence < 0.85. Backend returns `IGNORED`. Gate remains closed. |
| **9** | `IOT_1` | Verification of Engine Telemetry Alerts. | ESP32 OBD Simulator is actively polling. | 1) Adjust potentiometer to simulate engine temp > 105°C.<br>2) Monitor React Dashboard. | 1) Analog value > threshold. | **Alert successful.** WebSocket broadcasts payload in < 500ms. Red Toast notification appears on Admin UI. |
| **10** | `Crowd_1` | Verification of Dual Crowding Fusion auto-dispatch. | Vehicle capacity must be defined in DB. | 1) Override YOLOv8 headcount integer to 95%.<br>2) Override Ticket validation array to 92%. | 1) Visual: 95%.<br>2) Cryptographic: 92%. | **Emergency successful.** Fused score > 90%. System auto-dispatches an `OFF_DUTY` standby driver. |

### Summary of Testing
As demonstrated in the comprehensive matrix above, the Garago architecture proved exceptionally resilient. The integration of Pydantic validation and Starlette Sanitization Middleware completely neutralized injection attempts. The deep learning OCR pipeline demonstrated its most crucial safety feature: failing securely. By implementing a strict 0.85 confidence threshold (`OCR_2`), the system guaranteed that an illegible license plate would simply be ignored, rather than generating a false positive and opening the gate for an unauthorized vehicle. The hardware-in-the-loop (HIL) tests confirmed that the physical ESP32 nodes respond to backend actuation commands asynchronously without locking up their primary sensor polling loops.
