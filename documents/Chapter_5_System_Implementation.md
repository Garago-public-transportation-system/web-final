--- (Page Break) ---

# Chapter 5: System Implementation

## 5.1 Introduction
System implementation marks a crucial phase in the life cycle of any technological solution, involving the transition from theoretical design and UML diagrams to the practical application of the system in a real-world environment. This phase encompasses a series of carefully planned and executed steps to deploy, configure, and integrate the codebase into the existing municipal infrastructure.

In this phase, the chapter is separated into three primary disciplines:
*   **Mobile Application Implementation:** Details the development of the user-facing mobile interfaces, covering UI/UX design, state management, and the technologies used for driver interaction.
*   **Backend Implementation:** Focuses on the core Python logic, specifically the asynchronous loops required for high-frequency hardware polling and algorithmic driver scheduling.
*   **Artificial Intelligence Architecture:** Deeply explains the mathematical and structural layers of the Deep Learning networks utilized for vehicle tracking and plate recognition.

## 5.2 Mobile Application Implementation
The Garago smart transit system leverages the power of cross-platform native development to deliver a robust and efficient mobile experience for the fleet drivers. The application was built using the Flutter SDK and the Dart programming language, taking full advantage of native-compiled performance optimizations while maintaining a single codebase for both Android and iOS targets. Android Studio and VS Code served as our primary IDEs, providing comprehensive tools for UI rendering and debugging.

### 5.2.1 Native Compilation Advantages
While hybrid web-wrappers (like Cordova or Ionic) exist, we chose a compiled native framework (Flutter) to maximize performance.
1.  **Performance and Speed:** Flutter apps do not rely on an intermediary JavaScript bridge. The Dart code is compiled Directly Ahead-of-Time (AOT) into native ARM machine code. This allows the app to run significantly faster, as the code is executed directly by the device's CPU.
2.  **Direct Access to Hardware:** Drivers require immediate and complete access to device hardware capabilities, specifically GPS for spatial mapping. Native-compiled apps eliminate the latency inherent in web browsers when pinging geolocation satellites.
3.  **Responsiveness and 60 FPS:** The UI is rendered using the low-level Skia graphics engine, ensuring a buttery-smooth 60 Frames Per Second (FPS) user experience, crucial for displaying complex map animations without stuttering.
4.  **Business Logic Components (BLoC):** To ensure deterministic UI states, the app relies heavily on the `flutter_bloc` state management pattern. Network logic is strictly separated from the Presentation layer, preventing UI lockups during slow HTTP requests.

## 5.3 Backend Server Implementation
The core nervous system of the Garago platform is the asynchronous Python backend, developed utilizing the FastAPI framework.

### 5.3.1 Asynchronous Concurrency
Traditional synchronous web frameworks (like Django) spawn a heavy OS thread for every incoming hardware request. If 500 ESP32 nodes simultaneously ping the server, a synchronous framework will instantly exhaust server memory and crash.
FastAPI solves this via Python's `asyncio` event loop. When the server queries the PostgreSQL database (which requires slow disk I/O), the `await` keyword yields execution back to the main loop. A single server process can effortlessly handle thousands of concurrent hardware HTTP POST requests, making it exceptionally efficient for IoT ingestion.

### 5.3.2 Algorithmic Scheduling Engine
The backend implements an `APScheduler` cron job that executes background logic independently of user web requests.
The core algorithm calculates a mathematical driver fatigue score: $F(t) = \min(20 \times \Delta t_{\text{hours}}, 100)$. 
Every five minutes, the background worker evaluates this continuous function across all active drivers in the database. If a primary driver's score exceeds $80.0$, the coroutine executes a deterministic "Ping-Pong" swap protocol. It automatically forces the primary driver to an `ON_BREAK` status and promotes the standby driver to `ACTIVE`, guaranteeing strict compliance with transit labor safety laws without human dispatcher intervention.

## 5.4 Artificial Intelligence Architectures
To automate gate security and calculate passenger capacity, the system integrates state-of-the-art Computer Vision algorithms directly into the FastAPI ingestion pipelines.

### 5.4.1 Object Detection Model – YOLOv8 Overview
You Only Look Once (YOLO) is a real-time object detection algorithm that has gained significant popularity due to its speed and accuracy. Unlike traditional two-stage detection pipelines (like R-CNN) that separate object localization and classification into multiple sluggish steps, YOLO performs both tasks in a single neural network pass. This unified approach dramatically improves inference time. We employed YOLOv8 to detect vehicle frames and perform real-time passenger headcounts inside the bus cabins.

**Key Architectural Components of YOLOv8:**
*   **Backbone (CSPDarknet53):** A deep convolutional neural network responsible for extracting low-level (edges/colors) and high-level (shapes/semantics) spatial features from the input image tensor. It captures the finest details of small targets like human heads or distant license plates.
*   **Neck (PANet):** The neck integrates Feature Pyramid Networks (FPN) and Path Aggregation Networks. It combines multi-scale features, which is crucial for detecting objects of varying sizes (e.g., a person sitting close to the camera versus a person standing at the back of the bus).
*   **Detection Head:** This module generates the actual bounding box predictions along with class probabilities. It utilizes an anchor-free architecture, drastically accelerating the Non-Maximum Suppression (NMS) post-processing step required to filter overlapping boxes.

### 5.4.2 Optical Character Recognition – EasyOCR Overview
While YOLOv8 is excellent at detecting *where* a license plate is, it cannot read the text. EasyOCR is an open-source optical character recognition engine that leverages deep learning to extract alphanumeric text from the cropped YOLO bounding box.
Unlike traditional systems (such as legacy Tesseract) which rely on rigid pixel-matching, EasyOCR thrives in real-world transit environments featuring low-resolution images, skewed camera angles, and noisy/dirty backgrounds.

**Core EasyOCR Architecture:**
EasyOCR’s architecture combines several deep learning components in a powerful sequence:
1.  **Convolutional Neural Networks (CNNs):** The pipeline first uses CNNs (often based on ResNet) to extract rich visual features from the cropped license plate image. These features capture local textures and spatial patterns critical for distinguishing an '8' from a 'B'.
2.  **Recurrent Neural Networks (RNNs):** Specifically, bi-directional Long Short-Term Memory (LSTM) networks are used to process the sequence of features over time. The LSTM captures the sequential dependencies between characters, allowing the model to "understand" the context of the string.
3.  **Connectionist Temporal Classification (CTC):** This is applied as the final output decoding layer. CTC enables the model to make predictions without requiring the image to be perfectly pre-segmented into individual letters. It dynamically aligns the predicted sequence with the image tensor, making it exceptionally resilient against overlapping or partially obscured license plates in harsh weather conditions.
