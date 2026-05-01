#pragma once

// ─── WiFi ────────────────────────────────────────────────────────────────────
#define WIFI_SSID        "AI Thinker"
#define WIFI_PASSWORD    "aHmEd061985"

// ─── Backend (Render cloud) ───────────────────────────────────────────────────
#define BACKEND_BASE     "http://10.78.222.40:8000/api/v1/hardware"

// ─── Hardware API Key — must match HARDWARE_API_KEY in backend .env ───────────
#define HW_API_KEY       "20fb404802c3950a14ecd47f7dd3fd70bdd2cd850ad55f630d551b7d0b435b85"

// ─── Camera IPs (local LAN) ───────────────────────────────────────────────────
#define ENTRY_CAM_IP     "10.78.222.55"
#define EXIT_CAM_IP      "10.78.222.184"

// ─── Gate logic ──────────────────────────────────────────────────────────────
#define MAX_CARS              6

// Distance — model bus surface sits 5-8 cm from sensor, hysteresis band 10→14
#define DETECT_CM             10
#define CLEAR_CM              14
#define BASELINE_MIN_CM       14      // empty-track baseline must read ≥ this

// Timing — tuned to a 14 cm model bus at slow demo speed
#define GATE_MIN_OPEN_MS      1500UL  // servo travel + visual confirmation
#define GATE_CLEAR_HOLD_MS    800UL   // hold after sensor confirms clear
#define GATE_MAX_OPEN_MS      15000UL // failsafe close

// Debounce — 100 ms loop × N samples
#define DETECT_CONFIRM_N      3
#define CLEAR_CONFIRM_N       3
