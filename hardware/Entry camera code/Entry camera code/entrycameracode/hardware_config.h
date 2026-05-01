#pragma once

// ─── WiFi ────────────────────────────────────────────────────────────────────
#define WIFI_SSID        "AI Thinker"
#define WIFI_PASSWORD    "aHmEd061985"

// ─── Backend (local network) ──────────────────────────────────────────────────
#define BACKEND_BASE     "http://192.168.1.14:8000/api/v1/hardware"

// ─── Hardware API Key — must match HARDWARE_API_KEY in backend .env ───────────
#define HW_API_KEY       "20fb404802c3950a14ecd47f7dd3fd70bdd2cd850ad55f630d551b7d0b435b85"

// ─── Camera IPs (local LAN) ───────────────────────────────────────────────────
#define ENTRY_CAM_IP     "10.78.222.55"
#define EXIT_CAM_IP      "10.78.222.184"

// ─── Gate logic ──────────────────────────────────────────────────────────────
#define MAX_CARS         6
#define DETECT_CM        10
#define CLEAR_CM         15
#define GATE_OPEN_MS     4000UL
