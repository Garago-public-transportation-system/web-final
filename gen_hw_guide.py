from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
import datetime

OUT = "HARDWARE_INTEGRATION_GUIDE.pdf"
W, H = A4

NAVY   = colors.HexColor("#0d1b2a")
BLUE   = colors.HexColor("#1b4f72")
LBLUE  = colors.HexColor("#2e86c1")
ACCENT = colors.HexColor("#1a5276")
RED    = colors.HexColor("#c0392b")
GREEN  = colors.HexColor("#1e8449")
ORANGE = colors.HexColor("#d35400")
LGREY  = colors.HexColor("#f4f6f7")
MGREY  = colors.HexColor("#aab7b8")
DGREY  = colors.HexColor("#2c3e50")
WHITE  = colors.white

def sty(name, **kw): return ParagraphStyle(name, **kw)

H1   = sty("H1", fontSize=14, textColor=NAVY, fontName="Helvetica-Bold", spaceBefore=18, spaceAfter=6)
H2   = sty("H2", fontSize=11, textColor=BLUE, fontName="Helvetica-Bold", spaceBefore=12, spaceAfter=4)
H3   = sty("H3", fontSize=10, textColor=LBLUE, fontName="Helvetica-Bold", spaceBefore=8, spaceAfter=3, leftIndent=10)
BODY = sty("BD", fontSize=9.5, textColor=DGREY, fontName="Helvetica", leading=15, spaceAfter=5, alignment=TA_JUSTIFY)
BODY_L = sty("BL", fontSize=9.5, textColor=DGREY, fontName="Helvetica", leading=15, spaceAfter=3, leftIndent=14, firstLineIndent=-10)
CAPTION = sty("CA", fontSize=8, textColor=MGREY, fontName="Helvetica-Oblique", alignment=TA_CENTER, spaceAfter=8)
TH = sty("TH", fontSize=8, textColor=WHITE, fontName="Helvetica-Bold", alignment=TA_CENTER)
TD = sty("TD", fontSize=8, textColor=DGREY, fontName="Helvetica", alignment=TA_CENTER, leading=11)
TDL = sty("TDL", fontSize=8, textColor=DGREY, fontName="Helvetica", alignment=TA_LEFT, leading=11)
COVER_TITLE = sty("CT", fontSize=24, textColor=WHITE, alignment=TA_CENTER, fontName="Helvetica-Bold", leading=30, spaceAfter=8)
COVER_SUB   = sty("CS", fontSize=11, textColor=colors.HexColor("#aed6f1"), alignment=TA_CENTER, fontName="Helvetica", spaceAfter=4)
COVER_META  = sty("CM", fontSize=9, textColor=colors.HexColor("#d6eaf8"), alignment=TA_CENTER, fontName="Helvetica-Oblique")

def sp(n=6): return Spacer(1, n)
def hr(): return HRFlowable(width="100%", thickness=0.8, color=LBLUE, spaceAfter=6, spaceBefore=4)
def b(t): return f"<b>{t}</b>"

# ── Section banner ─────────────────────────────────────────────────────────────
class Banner(Flowable):
    def __init__(self, text, bg=BLUE, h=40):
        self.text, self.bg, self._h = text, bg, h
    def wrap(self, aw, ah):
        self.aw = aw; return aw, self._h
    def draw(self):
        c = self.canv
        c.setFillColor(self.bg)
        c.roundRect(0, 0, self.aw, self._h, 4, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 11)
        c.drawString(14, self._h/2 - 5, self.text)

# ── Network topology diagram ───────────────────────────────────────────────────
class TopologyDiagram(Flowable):
    def __init__(self, w=480, h=200):
        self._w, self._h = w, h
    def wrap(self, aw, ah): return self._w, self._h
    def draw(self):
        c = self.canv
        W, H = self._w, self._h

        def box(x, y, w, h, lines, col, fs=7):
            c.setFillColor(col); c.roundRect(x, y, w, h, 4, fill=1, stroke=0)
            c.setFillColor(WHITE); c.setFont("Helvetica-Bold", fs)
            total = len(lines)
            for i, ln in enumerate(lines):
                cy = y + h - 12 - i * 10
                c.drawCentredString(x + w/2, cy, ln)

        def sensor_box(x, y, w, h, lines, col):
            c.setFillColor(col); c.setStrokeColor(col); c.setLineWidth(0.8)
            c.roundRect(x, y, w, h, 3, fill=1, stroke=0)
            c.setFillColor(WHITE); c.setFont("Helvetica", 6)
            for i, ln in enumerate(lines):
                c.drawCentredString(x + w/2, y + h - 9 - i * 8, ln)

        # WiFi cloud in centre-top
        cx = W / 2
        c.setFillColor(colors.HexColor("#d6eaf8")); c.setStrokeColor(LBLUE); c.setLineWidth(1)
        c.ellipse(cx-60, H-50, cx+60, H-10, fill=1, stroke=1)
        c.setFillColor(LBLUE); c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(cx, H-33, "WiFi LAN  192.168.1.x")

        # ── Master ESP32 (left) ──
        mx, my, mw, mh = 20, H-160, 120, 90
        box(mx, my, mw, mh, ["Master ESP32", "192.168.1.8", "(sketch_apr7a)"], NAVY, fs=7.5)
        c.setStrokeColor(LBLUE); c.setLineWidth(1.5)
        c.line(mx+mw/2, my+mh, cx-60, H-50)   # to WiFi

        # Sensors attached to master
        sensor_box(mx-2, my-32, 52, 28, ["HC-SR04 Entry", "TRIG=5, ECHO=18"], GREEN)
        sensor_box(mx+66, my-32, 52, 28, ["HC-SR04 Exit", "TRIG=19, ECHO=23"], GREEN)
        sensor_box(mx-2, my-68, 52, 28, ["Servo Entry", "GPIO 13 (PWM)"], ORANGE)
        sensor_box(mx+66, my-68, 52, 28, ["Servo Exit", "GPIO 12 (PWM)"], ORANGE)
        sensor_box(mx+23, my-108, 72, 28, ["I2C LCD  SDA=21, SCL=22", "LED_FULL=25, LED_ENTRY=26"], ACCENT)

        c.setFont("Helvetica-Oblique", 5.5); c.setFillColor(MGREY)
        c.drawString(mx-2, my-3, "Connected sensors & actuators:")
        c.line(mx+26, my, mx+14, my-4); c.line(mx+94, my, mx+82, my-4)   # connector lines
        c.line(mx+26, my, mx+14, my-40); c.line(mx+94, my, mx+82, my-40)

        # ── Entry ESP32-CAM (centre-right) ──
        ex, ey, ew, eh = cx+20, H-140, 110, 70
        box(ex, ey, ew, eh, ["Entry ESP32-CAM", "192.168.1.12", "(entrycameracode)"], BLUE, fs=7)
        c.setStrokeColor(LBLUE); c.setLineWidth(1.5)
        c.line(ex+ew/2, ey+eh, cx+20, H-50)
        sensor_box(ex+20, ey-30, 66, 24, ["OV2640 Camera", "(built-in, AI Thinker)"], colors.HexColor("#7d3c98"))

        # ── Exit ESP32-CAM (far right) ──
        rx, ry, rw, rh = W-130, H-140, 110, 70
        box(rx, ry, rw, rh, ["Exit ESP32-CAM", "192.168.1.13", "(exitcameracode)"], RED, fs=7)
        c.setStrokeColor(LBLUE); c.setLineWidth(1.5)
        c.line(rx+rw/2, ry+rh, cx+30, H-50)
        sensor_box(rx+20, ry-30, 66, 24, ["OV2640 Camera", "(built-in, AI Thinker)"], colors.HexColor("#7d3c98"))

        # ── Backend server (bottom centre) ──
        bx, by, bw2, bh2 = cx-60, 8, 120, 40
        box(bx, by, bw2, bh2, ["FastAPI Backend", "192.168.1.8:8000", "(app/main.py)"], ACCENT, fs=7)
        c.setStrokeColor(MGREY); c.setLineWidth(1)
        c.line(mx+mw/2, my, cx-10, by+bh2)
        c.line(ex+ew/2, ey, cx+10, by+bh2)
        c.line(rx+rw/2, ry, cx+30, by+bh2)

        c.setFillColor(MGREY); c.setFont("Helvetica-Oblique", 6.5)
        c.drawCentredString(W/2, 2, "Figure 1 - Hardware network topology (all devices on 192.168.1.x WiFi LAN)")

# ── GPIO pin map table ─────────────────────────────────────────────────────────
def gpio_table():
    data = [
        [Paragraph(t, TH) for t in ["Device", "GPIO Pin", "Connected To", "Direction", "Notes"]],
        *[[Paragraph(x, TDL if i == 0 else TD) for i, x in enumerate(r)] for r in [
            ["Master ESP32", "GPIO 5  (TRIG)", "HC-SR04 Entry — Trigger", "OUT", "Entry gate sensor"],
            ["Master ESP32", "GPIO 18 (ECHO)", "HC-SR04 Entry — Echo",    "IN",  "Entry gate sensor"],
            ["Master ESP32", "GPIO 19 (TRIG)", "HC-SR04 Exit — Trigger",  "OUT", "Exit gate sensor"],
            ["Master ESP32", "GPIO 23 (ECHO)", "HC-SR04 Exit — Echo",     "IN",  "Exit gate sensor"],
            ["Master ESP32", "GPIO 13 (PWM)",  "Servo — Entry Gate",      "OUT", "LEDC channel, 50 Hz"],
            ["Master ESP32", "GPIO 12 (PWM)",  "Servo — Exit Gate",       "OUT", "LEDC channel, 50 Hz"],
            ["Master ESP32", "GPIO 21 (SDA)",  "I2C LCD (16x2)",          "I2C", "LiquidCrystal_I2C"],
            ["Master ESP32", "GPIO 22 (SCL)",  "I2C LCD (16x2)",          "I2C", "LiquidCrystal_I2C"],
            ["Master ESP32", "GPIO 25",        "LED — GARAGE FULL",       "OUT", "HIGH when carCount = MAX_CARS"],
            ["Master ESP32", "GPIO 26",        "LED — ENTRY ALLOWED",     "OUT", "HIGH when space available"],
            ["Entry CAM",    "Built-in",       "OV2640 CMOS Sensor",      "IN",  "AI Thinker module"],
            ["Entry CAM",    "GPIO 4",         "Flash LED",               "OUT", "AI Thinker onboard"],
            ["Exit CAM",     "Built-in",       "OV2640 CMOS Sensor",      "IN",  "AI Thinker module"],
            ["Exit CAM",     "GPIO 4",         "Flash LED",               "OUT", "AI Thinker onboard"],
        ]]
    ]
    t = Table(data, colWidths=[2.8*cm, 3*cm, 4.5*cm, 2*cm, 4.2*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  NAVY),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [LGREY, WHITE]),
        ("GRID",          (0, 0), (-1, -1), 0.4, MGREY),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return t

# ── Data flow diagram ──────────────────────────────────────────────────────────
class DataFlowDiagram(Flowable):
    def __init__(self, w=480, h=100):
        self._w, self._h = w, h
    def wrap(self, aw, ah): return self._w, self._h
    def draw(self):
        c = self.canv
        stages = [
            ("HC-SR04\nSensor\n(< 10 cm)", NAVY),
            ("Master\nESP32\nLogic", BLUE),
            ("HTTP GET\n/capture\nto CAM IP", ACCENT),
            ("OV2640\nJPEG\nCapture", ORANGE),
            ("POST\nJPEG to\n/upload_raw", RED),
            ("EasyOCR\n+ OpenCV\nBackend", colors.HexColor("#7d3c98")),
            ("DB Lookup\n+ GateLog\nWrite", GREEN),
            ("Servo\nOpens\nGate", BLUE),
        ]
        bw = (self._w - 10) / len(stages) - 4
        bh = 58
        y = (self._h - bh) / 2
        for i, (label, col) in enumerate(stages):
            x = 4 + i * (bw + 4)
            c.setFillColor(col); c.roundRect(x, y, bw, bh, 4, fill=1, stroke=0)
            c.setFillColor(WHITE); c.setFont("Helvetica-Bold", 6)
            for j, ln in enumerate(label.split("\n")):
                c.drawCentredString(x + bw/2, y + bh - 11 - j * 9, ln)
            if i < len(stages) - 1:
                mx = x + bw + 2
                c.setStrokeColor(MGREY); c.setLineWidth(1)
                c.line(mx - 1, y + bh/2, mx + 3, y + bh/2)
                p = c.beginPath()
                p.moveTo(mx + 3, y + bh/2); p.lineTo(mx - 2, y + bh/2 + 3); p.lineTo(mx - 2, y + bh/2 - 3)
                p.close(); c.setFillColor(MGREY); c.drawPath(p, fill=1, stroke=0)
        c.setFillColor(MGREY); c.setFont("Helvetica-Oblique", 6.5)
        c.drawCentredString(self._w/2, 3, "Figure 2 - Complete data flow from physical sensor trigger to gate opening")

# ── Files table ────────────────────────────────────────────────────────────────
def files_table():
    data = [
        [Paragraph(t, TH) for t in ["File / Path", "Role", "Key Contents"]],
        *[[Paragraph(x, TDL) for x in r] for r in [
            ["hardware/hardware_config.h",
             "Shared config (all 3 devices)",
             "WIFI_SSID, WIFI_PASSWORD, HW_API_KEY, BACKEND_BASE, ENTRY_CAM_IP, EXIT_CAM_IP, MAX_CARS=4, DETECT_CM=10, CLEAR_CM=15, GATE_OPEN_MS=4000"],
            ["hardware/sketch_apr7a/.../sketch_apr7a.ino",
             "Master ESP32 firmware",
             "Reads 2x HC-SR04 sensors, drives 2x servos via LEDC PWM, controls LCD + LEDs, triggers cameras over HTTP, persists carCount to NVS"],
            ["hardware/Entry camera code/.../entrycameracode.ino",
             "Entry ESP32-CAM firmware",
             "Serves HTTP /capture endpoint; captures OV2640 JPEG; POSTs to /anpr/upload_raw with X-Hardware-API-Key; parses GRANTED/DENIED response"],
            ["hardware/exitcameracode/.../exitcamera_code_copy_20260410082200.ino",
             "Exit ESP32-CAM firmware",
             "Same as entry camera; gate_id=2; fixed off-by-one in GRANTED check (>= 0)"],
            ["app/api/v1/hardware.py",
             "FastAPI hardware router",
             "POST /log (204), POST /anpr/upload_raw (EasyOCR pipeline, GateLog write, WS broadcast), POST /anpr, POST /iot, POST /gps, POST /camera"],
            ["app/models/models.py",
             "DB models",
             "GateLog, IotSensorReading, GpsReading, CameraReading, MaintenanceRequest, Vehicle, VehicleStatus"],
            ["app/core/sockets.py",
             "WebSocket manager",
             "broadcast_to_role() sends gate_auth and iot_alert events to Manager/Admin dashboards in real time"],
        ]]
    ]
    t = Table(data, colWidths=[5.5*cm, 3.8*cm, 8.2*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  NAVY),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [LGREY, WHITE]),
        ("GRID",          (0, 0), (-1, -1), 0.4, MGREY),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))
    return t

# ── Remaining steps table ──────────────────────────────────────────────────────
def steps_table():
    data = [
        [Paragraph(t, TH) for t in ["Step", "Action", "Status"]],
        *[[Paragraph(x, TDL if i == 1 else TD) for i, x in enumerate(r)] for r in [
            ["1", "Set real HW_API_KEY in hardware/hardware_config.h (and the 3 sketch-folder copies) — matches HARDWARE_API_KEY in .env", "PENDING"],
            ["2", "Flash Master ESP32 via PlatformIO (sketch_apr7a folder) — USB cable, select COM port, click Upload", "PENDING"],
            ["3", "Flash Entry ESP32-CAM — GPIO0 to GND while powering on to enter flash mode; remove jumper after upload; press Reset", "PENDING"],
            ["4", "Flash Exit ESP32-CAM — same GPIO0 flash procedure as entry camera", "PENDING"],
            ["5", "Start backend: uvicorn app.main:app --reload; confirm /hardware/log returns 204", "PENDING"],
            ["6", "Open Serial Monitor (115200 baud) for each device; confirm WiFi connects and sendLog() returns 204 (not 403/404)", "PENDING"],
            ["7", "Trigger entry camera manually: GET http://192.168.1.12/capture — verify JPEG upload and GRANTED/DENIED response in Serial Monitor", "PENDING"],
            ["8", "Full integration test: vehicle approaches sensor -> gate opens -> GateLog row in DB -> Manager dashboard WS event fires", "PENDING"],
            ["9", "(Optional) Wire GPS module to UART2 (RX=GPIO16, TX=GPIO17); POST NMEA data to POST /hardware/gps", "OPTIONAL"],
            ["10", "(Optional) Wire I2C sensors (ADS1115 ADC) to SDA=GPIO21, SCL=GPIO22; POST readings to POST /hardware/iot", "OPTIONAL"],
        ]]
    ]
    t = Table(data, colWidths=[1.2*cm, 12.5*cm, 2.8*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  BLUE),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [LGREY, WHITE]),
        ("GRID",          (0, 0), (-1, -1), 0.4, MGREY),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("TEXTCOLOR",     (2, 1), (-1, -2), RED),
        ("TEXTCOLOR",     (2, -2), (-1, -1), ORANGE),
        ("FONTNAME",      (2, 1), (-1, -1), "Helvetica-Bold"),
    ]))
    return t

# ── MAIN BUILD ─────────────────────────────────────────────────────────────────
def build():
    doc = SimpleDocTemplate(
        OUT, pagesize=A4,
        leftMargin=2.2*cm, rightMargin=2.2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
        title="Hardware Integration Guide",
        author="Smart Bus Garage Management System",
    )
    S = []

    # Cover
    S.append(sp(1.5*28))
    class Cover(Flowable):
        def wrap(self, aw, ah): self.aw = aw; return aw, 120
        def draw(self):
            c = self.canv
            c.setFillColor(NAVY); c.roundRect(0, 0, self.aw, 120, 6, fill=1, stroke=0)
    S.append(Cover())
    S.append(sp(-120)); S.append(sp(16))
    S.append(Paragraph("HARDWARE INTEGRATION GUIDE", COVER_TITLE))
    S.append(Paragraph("Smart Bus Garage Management System", COVER_SUB))
    S.append(Paragraph("MTI University  |  3x ESP32 Devices + 6 Sensors & Actuators", COVER_META))
    S.append(Paragraph(f"Generated {datetime.date.today().strftime('%B %Y')}", COVER_META))
    S.append(sp(1.5*28))

    # ==========================================================================
    # Section 1 — Hardware Overview
    # ==========================================================================
    S.append(Banner("1.  Hardware Overview", bg=NAVY))
    S.append(sp(8))

    S.append(Paragraph("1.1  System Architecture Summary", H2))
    S.append(Paragraph(
        "The garage hardware layer consists of three Espressif ESP32 microcontrollers "
        "communicating over a shared WiFi LAN (192.168.1.x subnet). All three devices "
        "connect to the FastAPI backend running on the same network. The system is "
        "self-contained within the local network — no internet connection is required "
        "for operation.", BODY))

    S.append(Paragraph("1.2  Complete Hardware Inventory", H2))
    S.append(Paragraph(
        "The system comprises three ESP32 microcontrollers plus the following physical "
        "sensors and actuators wired to the Master ESP32 and the two camera modules. "
        "Every component listed below is required for full end-to-end operation:", BODY))

    inv_data = [
        [Paragraph(t, TH) for t in ["Component", "Qty", "Connected To", "Function"]],
        *[[Paragraph(x, TDL if i == 0 else TD) for i, x in enumerate(r)] for r in [
            ["Master ESP32 (Generic Dev Module)", "1", "—", "Central controller: reads sensors, drives actuators, triggers cameras via HTTP, persists state"],
            ["Entry ESP32-CAM (AI Thinker)", "1", "WiFi LAN", "Captures JPEG at entry gate; uploads to backend ANPR pipeline"],
            ["Exit ESP32-CAM (AI Thinker)", "1", "WiFi LAN", "Captures JPEG at exit gate; uploads to backend ANPR pipeline"],
            ["HC-SR04 Ultrasonic Sensor — ENTRY", "1", "Master ESP32 GPIO 5/18", "Detects vehicle approaching entry gate (< 10 cm threshold)"],
            ["HC-SR04 Ultrasonic Sensor — EXIT", "1", "Master ESP32 GPIO 19/23", "Detects vehicle approaching exit gate (< 10 cm threshold)"],
            ["Servo Motor — Entry Gate", "1", "Master ESP32 GPIO 13", "Physical gate arm: 0 deg = closed, 90 deg = open (4000 ms)"],
            ["Servo Motor — Exit Gate", "1", "Master ESP32 GPIO 12", "Physical gate arm: 0 deg = closed, 90 deg = open (4000 ms)"],
            ["I2C LCD Display (16x2)", "1", "Master SDA=GPIO21, SCL=GPIO22", "Shows real-time occupancy: e.g. 'Free Slots: 3'"],
            ["LED — GARAGE FULL (red)", "1", "Master ESP32 GPIO 25", "Lights when carCount = MAX_CARS (4); entry physically blocked"],
            ["LED — ENTRY ALLOWED (green)", "1", "Master ESP32 GPIO 26", "Lights when carCount < MAX_CARS; entry open"],
            ["OV2640 Camera (AI Thinker built-in)", "2", "Entry/Exit CAM modules", "VGA JPEG capture (640x480, quality 12); streams to backend via HTTP POST"],
            ["FTDI USB-Serial Programmer", "1 (shared)", "GPIO0 to GND for flash mode", "Required to flash both ESP32-CAM boards (not needed for Master ESP32)"],
        ]]
    ]
    inv_t = Table(inv_data, colWidths=[5.2*cm, 1*cm, 4*cm, 6.3*cm])
    inv_t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  NAVY),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [LGREY, WHITE]),
        ("GRID",          (0, 0), (-1, -1), 0.4, MGREY),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("FONTNAME",      (0, 1), (0, 3),   "Helvetica-Bold"),
        ("TEXTCOLOR",     (0, 1), (0, 3),   BLUE),
    ]))
    S.append(inv_t)
    S.append(Paragraph("Table 1 — Complete hardware inventory (3 ESP32 devices + 9 sensors/actuators)", CAPTION))

    S.append(Paragraph("1.3  Network Topology", H2))
    S.append(TopologyDiagram())
    S.append(sp(6))
    S.append(Paragraph(
        "The Master ESP32 (192.168.1.8) acts as the central hub. When an ultrasonic "
        "sensor detects a vehicle, the master sends an HTTP GET to the relevant camera "
        "IP. The camera then POSTs the captured JPEG directly to the FastAPI backend. "
        "The backend runs OCR, performs a database lookup, and returns GRANTED or DENIED "
        "as plain text. The master opens the gate servo only on a GRANTED response.", BODY))
    S.append(PageBreak())

    # ==========================================================================
    # Section 2 — Data Flow
    # ==========================================================================
    S.append(Banner("2.  Data Flow — Sensor to Gate Open", bg=NAVY))
    S.append(sp(8))
    S.append(DataFlowDiagram())
    S.append(sp(10))

    steps = [
        ("Step 1 — Vehicle Detection",
         "The HC-SR04 ultrasonic sensor on the Master ESP32 measures the distance "
         "continuously. When distance < DETECT_CM (10 cm), the master sets the "
         "inDetected flag and calls handleEntryGate() or handleExitGate()."),
        ("Step 2 — Camera Trigger",
         "Master sends HTTP GET to http://ENTRY_CAM_IP/capture (192.168.1.12 for entry, "
         "192.168.1.13 for exit). Timeout is 15,000 ms. The camera's WebServer handles "
         "the request on its /capture route."),
        ("Step 3 — JPEG Capture",
         "The ESP32-CAM captures a VGA (640x480) JPEG frame using the OV2640 sensor. "
         "Up to 3 retry attempts with 300 ms between them. If all fail, "
         "reinitCamera() is called before one final attempt."),
        ("Step 4 — JPEG Upload to Backend",
         "Camera POSTs raw JPEG bytes to POST /api/v1/hardware/anpr/upload_raw?gate_id=1 "
         "(or gate_id=2 for exit). The X-Hardware-API-Key header is included for authentication. "
         "Content-Type is image/jpeg."),
        ("Step 5 — OCR Processing",
         "Backend decodes JPEG with OpenCV (cv2.imdecode). EasyOCR runs text detection. "
         "The highest-confidence detection is selected. A regex strips non-alphanumeric "
         "characters (re.sub('[^A-Z0-9]', '', text.upper()))."),
        ("Step 6 — Confidence Check",
         "If OCR confidence >= 0.85 (85%): proceed to DB lookup. "
         "If confidence < 0.85: event logged as IGNORED, DENIED returned to camera."),
        ("Step 7 — Database Lookup",
         "Backend queries the Vehicle table for a matching plate_number with status "
         "in (EN_ROUTE, ASSIGNED, FREE). If found: event = GRANTED. If not found: event = DENIED."),
        ("Step 8 — GateLog Write + WebSocket",
         "A GateLog row is inserted with gate_id, plate_number, confidence, event, "
         "and vehicle_id. broadcast_to_role('MANAGER') and broadcast_to_role('ADMIN') "
         "send a gate_auth WebSocket event to all connected dashboards."),
        ("Step 9 — Response Chain",
         "Backend returns PlainTextResponse('GRANTED') or PlainTextResponse('DENIED'). "
         "Camera forwards this as HTTP 200 'GRANTED' or HTTP 403 to the master. "
         "Master checks for 'GRANTED' substring."),
        ("Step 10 — Gate Opens",
         "On GRANTED: setGateIn(true) opens the servo. gateInOpen = true, "
         "gateInOpenTime = millis(). carCount++ is persisted to NVS (Preferences library). "
         "LCD updates to show new occupancy count."),
        ("Step 11 — Gate Closes (Non-Blocking)",
         "At the top of loop(), if millis() - gateInOpenTime >= GATE_OPEN_MS (4000 ms), "
         "setGateIn(false) closes the servo. The gate timer is millis()-based so "
         "sensor reads and HTTP calls continue during the 4-second open window."),
    ]
    for title, desc in steps:
        S.append(KeepTogether([
            Paragraph(f"<b>{title}</b>", H3),
            Paragraph(desc, BODY),
        ]))
    S.append(PageBreak())

    # ==========================================================================
    # Section 3 — GPIO Pin Mapping
    # ==========================================================================
    S.append(Banner("3.  GPIO Pin Mapping", bg=NAVY))
    S.append(sp(8))
    S.append(Paragraph(
        "The following table documents every physical wire connection in the system. "
        "Use this as the reference when wiring or debugging hardware.", BODY))
    S.append(gpio_table())
    S.append(Paragraph("Table 2 — Complete GPIO pin mapping for all three ESP32 devices", CAPTION))
    S.append(PageBreak())

    # ==========================================================================
    # Section 4 — Key Files
    # ==========================================================================
    S.append(Banner("4.  Key Files and What They Do", bg=NAVY))
    S.append(sp(8))
    S.append(Paragraph(
        "The hardware integration spans firmware files (inside the hardware/ directory) "
        "and backend Python files (inside app/). The table below describes every file "
        "you need to understand or modify to work with the hardware layer.", BODY))
    S.append(files_table())
    S.append(Paragraph("Table 3 — Key files for hardware integration", CAPTION))

    S.append(sp(10))
    S.append(Paragraph("4.1  hardware_config.h — The Master Configuration File", H2))
    S.append(Paragraph(
        "hardware_config.h is the single source of truth for all credentials and constants. "
        "It is #include'd by all three .ino sketch files. A copy lives in each sketch folder "
        "so the PlatformIO/Arduino compiler can find it with a simple #include. "
        "The file is excluded from git to protect credentials.", BODY))
    for define, value, note in [
        ("WIFI_SSID",        '"WE_4F038C"',           "Your WiFi network name"),
        ("WIFI_PASSWORD",    '"d0288c90"',             "Your WiFi password"),
        ("HW_API_KEY",       '"your_key_from_.env"',   "Must match HARDWARE_API_KEY in backend .env"),
        ("BACKEND_BASE",     '"http://192.168.1.8:8000/api/v1/hardware"', "All backend URLs built from this"),
        ("ENTRY_CAM_IP",     '"192.168.1.12"',          "Entry ESP32-CAM IP (set fixed in router)"),
        ("EXIT_CAM_IP",      '"192.168.1.13"',          "Exit ESP32-CAM IP (set fixed in router)"),
        ("MAX_CARS",         "4",                       "Physical garage capacity — gate refuses entry when carCount = 4"),
        ("DETECT_CM",        "10",                      "HC-SR04 trigger distance in centimetres"),
        ("CLEAR_CM",         "15",                      "Hysteresis band — detection flag clears above this distance"),
        ("GATE_OPEN_MS",     "4000UL",                  "Milliseconds the servo gate stays open"),
    ]:
        S.append(Paragraph(f"  <b>#define {define}</b>  {value} — {note}", BODY_L))
    S.append(PageBreak())

    # ==========================================================================
    # Section 5 — Remaining Steps
    # ==========================================================================
    S.append(Banner("5.  Remaining Steps to Complete Integration", bg=RED))
    S.append(sp(8))
    S.append(Paragraph(
        "The firmware and backend code changes are complete. The steps below are "
        "the physical and configuration actions needed to make the system fully "
        "operational on real hardware.", BODY))
    S.append(steps_table())
    S.append(Paragraph("Table 4 — Remaining integration steps", CAPTION))

    S.append(sp(10))
    S.append(Banner("Quick Reference: Flash Mode for ESP32-CAM", bg=ORANGE, h=34))
    S.append(sp(6))
    for line in [
        "1. Connect GPIO0 to GND on the ESP32-CAM board using a jumper wire.",
        "2. Power the board (or press Reset) — it is now in flash mode.",
        "3. In VS Code PlatformIO, select the correct COM port and click Upload.",
        "4. Wait for 'Leaving... Hard resetting...' message in the upload terminal.",
        "5. Remove the GPIO0-to-GND jumper.",
        "6. Press the Reset button on the ESP32-CAM board.",
        "7. Open Serial Monitor at 115200 baud — you should see WiFi connecting.",
    ]:
        S.append(Paragraph(line, BODY_L))

    doc.build(S)
    print(f"Generated: {OUT}")

if __name__ == "__main__":
    build()
