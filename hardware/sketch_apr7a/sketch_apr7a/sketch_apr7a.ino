/*
 * Garago — ESP32 Master Gate Controller
 * Backend: https://web-cz9z.onrender.com (Render, HTTPS)
 * Camera calls: local HTTP to 192.168.1.12 / 192.168.1.13
 */

#include "hardware_config.h"
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClient.h>
// Brown-out detector registers — used in setup() to disable BOD as a
// workaround for a flaky power supply. Not a real fix; see setup().
#include "soc/rtc_cntl_reg.h"
#include "soc/soc.h"

// ─── Local camera URLs (LAN — plain HTTP) ────────────────────────────────────
#define ENTRY_CAM_URL "http://" ENTRY_CAM_IP "/capture"
#define EXIT_CAM_URL "http://" EXIT_CAM_IP "/capture"

// ─── Pins
// ─────────────────────────────────────────────────────────────────────
#define TRIG_IN 5
#define ECHO_IN 18
#define TRIG_OUT 19
#define ECHO_OUT 23
#define SERVO_IN 13
#define SERVO_OUT 12
#define LED_ENTRY 25
#define LED_FULL 26
#define LED_EXIT 27

// ─── Globals
// ──────────────────────────────────────────────────────────────────
Preferences prefs;

volatile int carCount = 0;
volatile bool inDetected = false;
volatile bool outDetected = false;
volatile bool entryBusy = false;
volatile bool exitBusy = false;

bool gateInOpen = false;
bool gateOutOpen = false;
unsigned long gateInOpenTime = 0;
unsigned long gateOutOpenTime = 0;
unsigned long gateInLastSeen = 0;
unsigned long gateOutLastSeen = 0;
uint8_t inDetectStreak = 0, inClearStreak = 0;
uint8_t outDetectStreak = 0, outClearStreak = 0;

const int pwmFreq = 50;
const int pwmResolution = 16;

// ─── Servo
// ────────────────────────────────────────────────────────────────────
uint32_t angleToDuty(int angle) {
  return (uint32_t)map(angle, 0, 180, 1638, 8192);
}
// Open angle is on the opposite side of the closed angle so each arm rotates
// UP (toward the sky) instead of DOWN when the gate opens.
void setGateIn(bool open) { ledcWrite(SERVO_IN, angleToDuty(open ? 0 : 90)); }
void setGateOut(bool open) {
  ledcWrite(SERVO_OUT, angleToDuty(open ? 90 : 180));
}
// ─── Ultrasonic
// ───────────────────────────────────────────────────────────────
long readDistanceCM(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long d = pulseIn(echoPin, HIGH, 30000);
  return (d == 0) ? 999 : (long)(d * 0.034 / 2.0);
}

// 3-sample median rejects single spurious pings
long readDistanceMedian(int trigPin, int echoPin) {
  long a = readDistanceCM(trigPin, echoPin);
  long b = readDistanceCM(trigPin, echoPin);
  long c = readDistanceCM(trigPin, echoPin);
  if (a > b) {
    long t = a;
    a = b;
    b = t;
  }
  if (b > c) {
    long t = b;
    b = c;
    c = t;
  }
  if (a > b) {
    long t = a;
    a = b;
    b = t;
  }
  return b;
}

// Sensor-driven close decision: min hold → still-clear → grace → failsafe
bool shouldClose(bool isOpen, unsigned long openedAt, unsigned long lastSeen,
                 uint8_t clearStreak) {
  if (!isOpen)
    return false;
  unsigned long now = millis();
  if (now - openedAt < GATE_MIN_OPEN_MS)
    return false;
  if (now - openedAt > GATE_MAX_OPEN_MS)
    return true;
  if (clearStreak < CLEAR_CONFIRM_N)
    return false;
  return (now - lastSeen) >= GATE_CLEAR_HOLD_MS;
}

// ─── LEDs
// ──────────────────────────────────────────────────────────────────
void updateStatusLEDs() {
  bool full = (carCount >= MAX_CARS);
  digitalWrite(LED_ENTRY, full ? LOW : HIGH);
  digitalWrite(LED_FULL, full ? HIGH : LOW);
}

// ─── Log to backend (plain HTTP — backend is on the LAN) ─────────────────────
// Was WiFiClientSecure, but the backend is plain HTTP on port 8000 and
// mbedTLS handshake buffers (~12-16 KB) overflow the 8 KB Arduino loopTask
// stack on the very first call from setup() → recursive panic at boot.
void sendLog(const String &msg) {
  if (WiFi.status() != WL_CONNECTED)
    return;
  WiFiClient client;
  HTTPClient http;
  http.begin(client, BACKEND_BASE "/log");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Hardware-API-Key", HW_API_KEY);
  String json = "{\"device\":\"ESP32_MAIN\",\"msg\":\"" + msg + "\"}";
  http.POST(json);
  http.end();
}

// ─── WiFi
// ─────────────────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected — IP: " + WiFi.localIP().toString());
  sendLog("WiFi connected");
}
void ensureWiFiConnected() {
  if (WiFi.status() == WL_CONNECTED)
    return;
  Serial.println("WiFi lost — reconnecting...");
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 10000)
    delay(500);
  if (WiFi.status() == WL_CONNECTED)
    sendLog("WiFi reconnected");
}

// ─── Trigger local camera (plain HTTP — same LAN) ────────────────────────────
bool triggerCamera(const char *url, const char *name) {
  ensureWiFiConnected();
  if (WiFi.status() != WL_CONNECTED)
    return false;
  HTTPClient http;
  http.begin(url);
  http.setTimeout(15000);
  Serial.println(String("Triggering ") + name);
  sendLog(String("Triggering ") + name);
  int code = http.GET();
  bool granted = false;
  if (code > 0) {
    String response = http.getString();
    Serial.println(String(name) + " reply: " + response);
    sendLog(String(name) + " reply: " + response);
    granted = (response.indexOf("GRANTED") >= 0);
  } else {
    Serial.println(String(name) + " error: " + String(code));
    sendLog(String(name) + " error: " + String(code));
  }
  http.end();
  return granted;
}

// ─── FreeRTOS gate tasks
// ──────────────────────────────────────────────────────
// Flow: sensor confirms object → trigger camera ESP32-CAM via HTTP GET
//       → camera captures & uploads to backend ANPR → replies "GRANTED" or
//         "DENIED" → open servo only on GRANTED.
// Stack: 12 KB — HTTPClient + WiFiClient + String response need >8 KB.

void entryGateTask(void * /*param*/) {
  if (carCount >= MAX_CARS) {
    Serial.println("ENTRY BLOCKED: garage full");
    sendLog("ENTRY BLOCKED: full");
  } else {
    Serial.println("ENTRY detected — calling entry camera for ANPR");
    sendLog("ENTRY detected — calling entry camera");
    bool granted = triggerCamera(ENTRY_CAM_URL, "EntryCam");
    if (granted) {
      setGateIn(true);
      gateInOpen = true;
      gateInOpenTime = millis();
      gateInLastSeen = millis();
      Serial.println("Entry gate OPEN — ANPR granted");
      sendLog("Entry gate open — ANPR granted");
    } else {
      Serial.println("Entry gate DENIED by ANPR");
      sendLog("Entry gate denied — ANPR");
    }
  }
  entryBusy = false;
  vTaskDelete(NULL);
}

void exitGateTask(void * /*param*/) {
  if (carCount <= 0) {
    Serial.println("EXIT IGNORED: garage empty");
    sendLog("EXIT IGNORED: empty");
  } else {
    Serial.println("EXIT detected — calling exit camera for ANPR");
    sendLog("EXIT detected — calling exit camera");
    bool granted = triggerCamera(EXIT_CAM_URL, "ExitCam");
    if (granted) {
      setGateOut(true);
      gateOutOpen = true;
      gateOutOpenTime = millis();
      gateOutLastSeen = millis();
      Serial.println("Exit gate OPEN — ANPR granted");
      sendLog("Exit gate open — ANPR granted");
    } else {
      Serial.println("Exit gate DENIED by ANPR");
      sendLog("Exit gate denied — ANPR");
    }
  }
  exitBusy = false;
  vTaskDelete(NULL);
}

// ─── Setup
// ────────────────────────────────────────────────────────────────────
void setup() {
  // WORKAROUND: disable the brown-out detector. The dev board's 3.3V rail
  // sags under transient load and the BOD was resetting the chip during
  // boot. Disabling it lets the chip run, but flash/NVS writes during a
  // dip can corrupt silently — replace the cable / wall-adapter / board
  // and re-enable BOD before relying on this in production.
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);

  pinMode(TRIG_IN, OUTPUT);
  pinMode(ECHO_IN, INPUT);
  pinMode(TRIG_OUT, OUTPUT);
  pinMode(ECHO_OUT, INPUT);
  pinMode(LED_ENTRY, OUTPUT);
  pinMode(LED_FULL, OUTPUT);
  pinMode(LED_EXIT, OUTPUT);
  digitalWrite(LED_ENTRY, LOW);
  digitalWrite(LED_FULL, LOW);
  digitalWrite(LED_EXIT, LOW);

  ledcAttach(SERVO_IN, pwmFreq, pwmResolution);
  ledcAttach(SERVO_OUT, pwmFreq, pwmResolution);
  setGateIn(false);
  setGateOut(false);

  connectWiFi();

  prefs.begin("garage", false);
  carCount = prefs.getInt("carCount", 0);
  prefs.putInt("carCount", 4); 
  carCount = 4;
  Serial.println("Restored carCount: " + String(carCount));

  updateStatusLEDs();
  Serial.println("ESP32 Master Gate Controller Ready");
  sendLog("ESP32 Master Ready");
}

// ─── Loop
// ─────────────────────────────────────────────────────────────────────
void loop() {
  long dIn = readDistanceMedian(TRIG_IN, ECHO_IN);
  long dOut = readDistanceMedian(TRIG_OUT, ECHO_OUT);

  // Streak counters with hysteresis dead-band between DETECT_CM and CLEAR_CM
  if (dIn < DETECT_CM) {
    if (inDetectStreak < 255)
      inDetectStreak++;
    inClearStreak = 0;
    gateInLastSeen = millis();
  } else if (dIn > CLEAR_CM) {
    if (inClearStreak < 255)
      inClearStreak++;
    inDetectStreak = 0;
  }

  if (dOut < DETECT_CM) {
    if (outDetectStreak < 255)
      outDetectStreak++;
    outClearStreak = 0;
    gateOutLastSeen = millis();
  } else if (dOut > CLEAR_CM) {
    if (outClearStreak < 255)
      outClearStreak++;
    outDetectStreak = 0;
  }

  // Close: sensor-driven, not time-driven
  if (shouldClose(gateInOpen, gateInOpenTime, gateInLastSeen, inClearStreak)) {
    setGateIn(false);
    gateInOpen = false;
    carCount++;
    prefs.putInt("carCount", (int)carCount);
    updateStatusLEDs();
    Serial.println("Entry confirmed — count=" + String(carCount));
    sendLog("Entry confirmed — count=" + String(carCount));
  }
  if (shouldClose(gateOutOpen, gateOutOpenTime, gateOutLastSeen,
                  outClearStreak)) {
    setGateOut(false);
    gateOutOpen = false;
    if (carCount > 0)
      carCount--;
    prefs.putInt("carCount", (int)carCount);
    updateStatusLEDs();
    Serial.println("Exit confirmed — count=" + String(carCount));
    sendLog("Exit confirmed — count=" + String(carCount));
  }

  // Open: debounced trigger
  if (inDetectStreak >= DETECT_CONFIRM_N && !inDetected && !entryBusy &&
      !gateInOpen) {
    inDetected = true;
    entryBusy = true;
    xTaskCreate(entryGateTask, "entry_gate", 12288, NULL, 1, NULL);
  }
  if (inClearStreak >= CLEAR_CONFIRM_N)
    inDetected = false;

  if (outDetectStreak >= DETECT_CONFIRM_N && !outDetected && !exitBusy &&
      !gateOutOpen) {
    outDetected = true;
    exitBusy = true;
    xTaskCreate(exitGateTask, "exit_gate", 12288, NULL, 1, NULL);
  }
  if (outClearStreak >= CLEAR_CONFIRM_N)
    outDetected = false;

  delay(100);
}
