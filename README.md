# Garago — Smart Bus Garage Management System

A fleet-operations platform for public-transport bus garages. It builds each day's
driver and vehicle roster, tracks trips as they run, reads number plates at the garage
gates with computer vision, manages driver breaks and mid-shift replacements, and
dispatches extra capacity when a route gets crowded.

Graduation project, Faculty of Computer Science — MTI University.

---

## Contents

- [The problem](#the-problem)
- [Architecture](#architecture)
- [Technology](#technology)
- [How the core subsystems work](#how-the-core-subsystems-work)
- [Security model](#security-model)
- [Data model](#data-model)
- [API surface](#api-surface)
- [Getting started](#getting-started)
- [Repository layout](#repository-layout)
- [Development workflow](#development-workflow)
- [Team](#team)

---

## The problem

A bus garage runs on decisions that are made hundreds of times a day and are almost
always made on paper: who drives which bus on which route, who covers a driver's break
without stranding a route, which bus is actually inside the garage right now, and what
to do when a route fills up faster than the timetable expects.

Each of those is cheap to get wrong and expensive to get wrong repeatedly — a
double-booked bus, a driver dispatched past a safe number of hours, a route left
unstaffed because the replacement driver was never released from an earlier break.

Garago models the garage as state that the system is responsible for keeping
consistent, rather than as a schedule someone maintains by hand.

---

## Architecture

```
   ┌──────────────────────┐
   │  ESP32-CAM gate      │  entry + exit cameras
   │  (Arduino / C++)     │
   └──────────┬───────────┘
              │  HTTP + X-Hardware-API-Key
              ▼
   ┌──────────────────────────────────────────────┐
   │                 FastAPI                      │
   │                                              │
   │  middleware   sanitisation → idempotency     │
   │  routers      admin / manager / driver /     │
   │               hardware / auth / websocket    │
   │  services     rotation · breaks · trips ·    │
   │               crowding · maintenance ·       │
   │               reports · audit                │
   │  scheduler    4 APScheduler jobs             │
   └───────┬───────────────────────────┬──────────┘
           │ async SQLAlchemy          │ WebSocket
           │ (asyncpg)                 │ role-scoped push
           ▼                           ▼
   ┌──────────────┐            ┌────────────────┐
   │ PostgreSQL   │            │  React SPA     │
   │ 22 tables    │◀───REST────│  (Vite + MUI)  │
   │ Alembic      │    JWT     │                │
   └──────────────┘            └────────────────┘
```

---

## Technology

| Layer | Choice | Why |
|---|---|---|
| API | FastAPI, Pydantic v2 | Async-native, and request/response validation is declarative rather than hand-rolled |
| Data | PostgreSQL, SQLAlchemy 2.0 async, asyncpg | The domain is relational and heavily constrained; enums and foreign keys do real work here |
| Migrations | Alembic | The schema is owned by migrations — the app never calls `create_all` |
| Auth | JWT (python-jose), bcrypt | Stateless access tokens, opaque refresh tokens held server-side |
| Realtime | WebSockets | Dispatch changes have to reach a driver's screen without polling |
| Scheduling | APScheduler (AsyncIO) | Runs in-process on the same event loop as the app |
| Vision | EasyOCR, OpenCV | Plate recognition on frames pushed from the gate cameras |
| Hardware | ESP32-CAM (Arduino/C++) | Cheap, network-capable camera at each gate |
| Frontend | React 19, Vite, MUI, Zustand, Recharts | Operator console with charts, RTL support, and role-specific dashboards |

Roughly 6,500 lines of backend Python across 22 tables, 13 domain enums, 84 endpoints,
and 13 migrations.

---

## How the core subsystems work

### Rotation and dispatch

`app/services/rotation_service.py` is the heart of the system.

Each morning a scheduled job builds the day's assignments: it takes the active routes,
the drivers currently `OFF_DUTY`, and the vehicles currently `FREE`, and pairs them
into `RotationAssignment` and `Trip` rows, staggering shift positions so a route is not
left uncovered at a handover.

The interesting part is regeneration. Rebuilding a day that already has assignments
means unwinding everything that depends on them, in an order the foreign keys allow:
`DriverExchange` first — it references both `rotation_assignments` **and** `trips` —
then `Ticket`, then `Trip`, then `RotationAssignment`. Only then are the affected
drivers and vehicles reset to `OFF_DUTY` and `FREE` so they are available to the new
schedule. Getting that order wrong leaves orphaned rows that no longer surface in any
view but still hold drivers and buses hostage.

Generation is idempotent by default: it counts existing assignments for the target date
and returns early unless regeneration is explicitly requested.

### Breaks and replacements

A driver who has run enough trips becomes eligible for a break. Rather than simply
pausing them, the system assigns a replacement driver to the route, tracks the swap as
a `DriverExchange`, and releases the replacement when the break ends. Every claim has a
matching release — a replacement who is never released stays unavailable to the next
day's roster.

Fatigue scoring and shift-end protection gate this: a driver close to the end of a
shift is not sent out on a replacement run they cannot finish.

### Crowding response

When a route crosses its configured crowding threshold, `trigger_auto_dispatch` looks
for an additional driver and vehicle — preferring the rostered pick, falling back to
any available driver — and sends out extra capacity, with a preparation-time buffer so
the dispatch is realistic rather than instantaneous.

### Gate automation (ANPR)

Cameras at the entry and exit gates post frames to `/api/v1/hardware/...`, authenticated
with an API key compared in constant time. Frames are decoded with OpenCV and read with
EasyOCR.

Raw OCR is not trustworthy on its own, so plate lookup runs in two stages. First an
exact match against `Vehicle.plate_number` after normalising away non-alphanumerics.
If that misses, a second pass substitutes the characters OCR most often confuses —
`O→0`, `I→1`, `L→1`, `S→5`, `B→8`, `Z→2`, `D→0`, `Q→0` — and retries. The substitution
is deliberately one-directional, digits winning, because plates here are digit-heavy;
making it bidirectional would let one misread resolve to several distinct vehicles.

Confidence thresholds gate the whole path, and every reading records which method
resolved it, so a wrong gate event stays auditable afterwards.

### Real-time updates

`app/core/sockets.py` keeps role-scoped connection sets for `ADMIN`, `MANAGER`, and
`DRIVER`. The handshake authenticates the JWT before joining a channel, applies a
per-connection rate limit, and uses custom close codes so a client can tell the
difference between "your token expired, refresh and reconnect" (`4401`) and "your token
is invalid" (`4003`) — a distinction the browser's generic `1006` hides.

### Background jobs

Four APScheduler jobs, each owning its own database session and catching its own
exceptions so one failure cannot take down the scheduler:

| Job | Cadence | Purpose |
|---|---|---|
| Daily assignment | Early morning | Builds the day's roster |
| Rotation manager | Continuous | Processes handovers and swaps as shifts progress |
| Lateness sweep | Every minute | Flips `is_late` on active trips past their grace window so on-time statistics stay honest |
| Midnight reset | Daily | Zeroes per-driver daily counters |

---

## Security model

| Concern | Implementation |
|---|---|
| Passwords | bcrypt with per-password salt |
| Access tokens | JWT, short-lived, carrying subject and role |
| Refresh tokens | Opaque, `secrets.token_urlsafe(48)` — not JWTs, so they cannot be self-validated |
| Password reset | Token returned to the user once, stored **only** as a bcrypt hash, 15-minute TTL — a leaked database yields no usable reset tokens |
| Authorisation | Role dependencies (`get_current_user_with_role`) resolved against the database user, not the token's role claim |
| Hardware auth | API key compared with `secrets.compare_digest`, never `==` |
| Replay protection | Idempotency middleware rejects a repeated `Idempotency-Key` on write methods, and releases the key on 5xx so a genuine retry still works |
| Input handling | Sanitisation middleware (bleach) plus Pydantic validation at every boundary |
| Rate limiting | slowapi, on the API and per WebSocket connection |
| Error responses | Global handlers return generic messages; internals and tracebacks never reach the client |
| Secrets | Environment only. No credentials in the source tree |

---

## Data model

22 tables. The operational core:

- **`garages`, `users`, `drivers`, `vehicles`** — the actors and the assets.
- **`routes`, `route_stops`** — the network.
- **`rotation_assignments`, `trips`, `driver_exchanges`, `break_logs`** — who is
  driving what, when, and who covered for them.
- **`gate_logs`, `camera_readings`, `gate_cameras`, `device_logs`** — the physical
  gate: what the cameras saw, how it was resolved, and what the devices reported.
- **`maintenance_requests`, `tickets`, `crowding_events`, `reroute_logs`,
  `notifications`, `daily_reports`, `audit_logs`, `gps_tracking`** — operations,
  revenue, incidents, and the audit trail.

13 enums (`UserRole`, `DriverStatus`, `VehicleStatus`, `TripStatus`, `TripDirection`,
`MaintenanceStatus`, `MaintenanceType`, `ShiftType`, `RotationPosition`,
`ReplacementReason`, `TripTicketStatus`, `RerouteStatus`, `NotificationStatus`) keep
state machines in the database rather than in string comparisons.

The full schema is defined in [`app/models/models.py`](app/models/models.py) and
versioned in [`alembic/versions/`](alembic/versions/).

---

## API surface

84 endpoints, mounted by audience:

| Prefix | Audience |
|---|---|
| `/api/v1/auth` | Login, refresh, password reset |
| `/api/v1/admin`, `/api/v1/admin/{users,drivers,vehicles,routes,tickets}` | Admin |
| `/api/v1/manager` | Manager dashboard and operations |
| `/api/v1/drivers` | Driver self-service |
| `/api/v1/users` | Cross-role profile |
| `/api/v1/hardware` | Gate cameras — API key, no user session |
| `/ws` | Role-scoped real-time channel |

Interactive OpenAPI documentation is generated by FastAPI and served at `/docs` once
the app is running.

---

## Getting started

### Requirements

Python 3.13+, PostgreSQL 14+, Node 18+.

### Backend

```bash
python -m venv venv && source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env       # then fill in DATABASE_URL, SECRET_KEY, HARDWARE_API_KEY
createdb smart_bus_garage
alembic upgrade head
python setup_admin.py
uvicorn app.main:app --reload
```

Generate the two secrets:

```bash
python -c "import secrets; print(secrets.token_hex(32))"      # SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(32))"  # HARDWARE_API_KEY
```

`setup_admin.py` seeds a local development admin (`admin@garago.com` / `admin`). It is
a convenience for local use only — change the credentials before running this anywhere
reachable.

### Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

### Sample data

`seed_exhaustive_matrix.py` generates a synthetic dataset — fictional drivers, routes,
vehicles, trips, and gate events — covering an exhaustive combination matrix of the
domain's states. It targets whatever `TEST_DATABASE_URL` points at and **wipes it
first**, so point it at a throwaway database:

```bash
export TEST_DATABASE_URL='postgresql+asyncpg://<user>:<password>@localhost:5432/test_smart_bus_garage'
python seed_exhaustive_matrix.py
```

The ANPR endpoints download EasyOCR model weights on first use; model binaries are not
vendored here.

---

## Repository layout

```
app/
  api/v1/         84 REST endpoints, split by audience
  api/deps.py     authentication and role dependencies
  core/           config, async session factory, JWT/bcrypt, rate limiting, sockets
  middleware/     idempotency, input sanitisation
  models/         22 SQLAlchemy tables, 13 domain enums
  schemas/        Pydantic request/response models
  services/       rotation, trips, breaks, crowding, maintenance, reports, audit, scheduler
alembic/versions/ 13 forward migrations
frontend/         React + Vite operator console
hardware/         ESP32-CAM firmware for the entry and exit gates
.claude/          AI agent harness used to develop this project
```

---

## Development workflow

This project is developed with an AI multi-agent harness, configured in
[`.claude/`](.claude/). Rather than treating an assistant as autocomplete, the work is
reviewed by specialised agents, each with a defined scope, its own trigger, and a
pass/fail contract:

| Agent | Watches | Blocks on |
|---|---|---|
| [`rbac-auditor`](.claude/agents/rbac-auditor.md) | `app/api/`, `deps.py`, `security.py` | An endpoint with no role dependency, a driver-scoped query with no ownership filter, privilege escalation through a write schema |
| [`async-api-reviewer`](.claude/agents/async-api-reviewer.md) | `app/` | Blocking calls on the event loop, missing `await`, session lifecycle errors, N+1 queries |
| [`migration-guard`](.claude/agents/migration-guard.md) | `app/models/`, `alembic/versions/` | A model change with no migration, split heads, a destructive migration with no real downgrade, in-place enum edits |
| [`ocr-pipeline-reviewer`](.claude/agents/ocr-pipeline-reviewer.md) | `hardware.py`, camera models, `hardware/` | State changed on a low-confidence or ambiguous plate read, weakened hardware auth |
| [`scheduling-invariant-checker`](.claude/agents/scheduling-invariant-checker.md) | rotation, break, trip, crowding services, `scheduler.py` | Double-booked driver or vehicle, fatigue or shift-end bypass, an unreleased break claim, a new table missing from the regeneration cascade |

[`/review`](.claude/commands/review.md) runs the whole board over the current diff in
parallel and returns one merged verdict.

Two rules hold the design together. Every agent is **read-only by construction** — they
report findings and never edit. And **no agent commits, pushes, or merges**: the human
is the only one who can ship. Project rules the agents enforce are in
[`CLAUDE.md`](CLAUDE.md).

---

## Team

| Area | Author |
|---|---|
| Backend, database, hardware integration, AI harness | [Omar Essam](https://github.com/omaressam7704) |
| Core data models | [omar1238-j](https://github.com/omar1238-j) |
