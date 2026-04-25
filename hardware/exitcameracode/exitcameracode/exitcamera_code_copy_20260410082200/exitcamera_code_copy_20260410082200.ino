/*
 * Garago — ESP32-CAM Exit Gate Camera
 * Board: AI Thinker ESP32-CAM
 * Backend: https://web-cz9z.onrender.com (Render, HTTPS)
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <HTTPClient.h>
#define CAMERA_MODEL_AI_THINKER
#include "camera_pins.h"
#include "hardware_config.h"

#define UPLOAD_URL  BACKEND_BASE "/anpr/upload_raw?gate_id=2"
#define LOG_URL     BACKEND_BASE "/log"

WebServer server(80);
bool cameraReady = false;

// ─── Log to Render backend (HTTPS) ───────────────────────────────────────────
void sendLog(const String& msg) {
  if (WiFi.status() != WL_CONNECTED) return;
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, LOG_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Hardware-API-Key", HW_API_KEY);
  String json = "{\"device\":\"CAM_EXIT\",\"msg\":\"" + msg + "\"}";
  http.POST(json);
  http.end();
}

// ─── WiFi ─────────────────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(); delay(100);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi connected — IP: " + WiFi.localIP().toString());
  sendLog("WiFi connected");
}
void ensureWiFiConnected() {
  if (WiFi.status() == WL_CONNECTED) return;
  connectWiFi();
}

// ─── Camera init ──────────────────────────────────────────────────────────────
bool initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size   = FRAMESIZE_VGA;
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode    = CAMERA_GRAB_LATEST;
  config.jpeg_quality = 12;
  if (psramFound()) {
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.fb_count    = 2;
  } else {
    config.fb_location = CAMERA_FB_IN_DRAM;
    config.fb_count    = 1;
  }
  if (esp_camera_init(&config) != ESP_OK) { Serial.println("Camera init failed"); return false; }
  Serial.print("Camera warm-up");
  for (int i = 0; i < 5; i++) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (fb) esp_camera_fb_return(fb);
    delay(100); Serial.print(".");
  }
  Serial.println(" done");
  return true;
}
bool reinitCamera() {
  esp_camera_deinit(); delay(500);
  return initCamera();
}

// ─── Capture & upload to Render (HTTPS) ──────────────────────────────────────
void handleCapture() {
  Serial.println("/capture triggered");
  sendLog("Capture triggered");
  ensureWiFiConnected();

  camera_fb_t* fb = nullptr;
  for (int i = 1; i <= 3; i++) {
    fb = esp_camera_fb_get();
    if (fb) break;
    Serial.printf("Attempt %d failed\n", i); delay(300);
  }
  if (!fb) {
    sendLog("Capture failed — reinitialising");
    if (!reinitCamera()) { server.send(500, "text/plain", "DENIED: Camera Fail"); return; }
    fb = esp_camera_fb_get();
    if (!fb) { server.send(500, "text/plain", "DENIED: Camera Null"); return; }
  }

  Serial.printf("Frame: %u bytes — uploading\n", fb->len);
  sendLog("Frame: " + String(fb->len) + " bytes");

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, UPLOAD_URL);
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("X-Hardware-API-Key", HW_API_KEY);
  http.setTimeout(20000);

  int code = http.POST(fb->buf, fb->len);
  esp_camera_fb_return(fb);

  Serial.printf("Backend HTTP: %d\n", code);
  sendLog("Backend HTTP: " + String(code));

  if (code > 0) {
    String response = http.getString();
    Serial.println("Backend: " + response);
    sendLog("Backend: " + response);
    if (response.indexOf("GRANTED") >= 0) {
      server.send(200, "text/plain", "GRANTED");
    } else {
      server.send(403, "text/plain", "DENIED");
    }
  } else {
    sendLog("Upload failed: " + String(code));
    server.send(500, "text/plain", "DENIED: Upload Failed");
  }
  http.end();
}

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);
  connectWiFi();
  cameraReady = initCamera();
  if (!cameraReady) {
    sendLog("Camera init failed — restarting");
    delay(3000); ESP.restart();
  }
  server.on("/capture", HTTP_GET, handleCapture);
  server.begin();
  Serial.println("EXIT CAMERA READY — waiting for /capture");
  sendLog("Exit camera ready");
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
void loop() {
  server.handleClient();
  delay(2);
}
