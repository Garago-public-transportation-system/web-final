# Garago — project context for AI agents

Auto-loaded every session. Read this before changing anything.

## What this is

A fleet-operations backend for public-transport bus garages: rotation scheduling,
trip tracking, driver breaks and replacements, maintenance, ticketing, crowding
response, and automatic number-plate recognition at the garage gates.

FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL + Alembic. Three roles share one
database and one API: `ADMIN`, `MANAGER`, `DRIVER`. Gate hardware is ESP32-CAM,
authenticated separately by API key with no user session.

## Runtime map

- App entry `app/main.py` — mounts routers, middleware (sanitisation, idempotency),
  the rate limiter, global exception handlers, and starts the scheduler in `lifespan`.
- `app/api/v1/` — HTTP handlers, split by audience.
- `app/services/` — business logic. `rotation_service.py` is the core of the system.
- `app/core/` — config, async session factory, JWT/bcrypt helpers, WebSocket manager.
- `app/models/models.py` — the whole schema in one module.
- `alembic/versions/` — the schema is owned by Alembic. `main.py` does **not** call
  `create_all`, deliberately.
- Settings are Pydantic-settings in `app/core/config.py`, loaded from `.env`.

## Standing rules (binding)

1. **The schema is Alembic's.** Never add `create_all`. Every model change ships with
   a migration in the same commit.
2. **Never hardcode a credential, host, or threshold.** Credentials come from the
   environment. Operational numbers come from `app/core/config.py`.
3. **`.env` is never committed.** It was once, and the secrets in it had to be
   rotated. `.env.example` carries placeholders only.
4. **Authorisation is a dependency, never a URL prefix.** Mounting under `/admin/`
   enforces nothing. Use `get_current_user_with_role(...)`, and filter driver-scoped
   queries by the caller's own id — an authenticated driver can still pass someone
   else's `driver_id`.
5. **Never trust an OCR read.** Confidence gates every state change. The confusable
   fallback runs last, stays one-directional, and every reading records how it
   resolved.
6. **Nothing blocking on the event loop.** `easyocr`, `cv2`, and any sync I/O in an
   `async def` handler stall every concurrent request. Push them to a thread.
7. **A new dependent table must join the regeneration cascade** in
   `rotation_service.generate_daily_schedule` and any per-day counter must join
   `midnight_reset_job`. Forgetting either fails silently, days later.
8. **Scheduler jobs own their session and catch their own exceptions.** One job must
   not be able to kill the scheduler.
9. **Errors never leak internals.** The global handler in `main.py` returns a generic
   500 on purpose. Do not echo `str(e)` to the client.
10. **Agents propose; the human merges.** No agent commits, pushes, or merges.

## Known rough edges (do not "fix" without asking)

- The idempotency cache is a process-local dict. That is fine for a single worker and
  wrong under multiple; replacing it means introducing Redis, which is a real
  architectural decision, not a cleanup.
- Chapter numbering under `documents/` is inconsistent (two Chapter 6s, two Chapter 7s)
  because the write-up was reorganised late. The markdown files are the current
  source; the PDFs are earlier renders.
- `test_db_csv/` and `clean_dump.sql` are synthetic fixtures, not real data.

## AI agents (auto-invoked — the user never names them)

Agents live in `.claude/agents/`. The orchestrator invokes them proactively at these
triggers, in parallel where independent:

| Trigger | Auto-run |
|---|---|
| Any change under `app/api/`, `deps.py`, `security.py` | `rbac-auditor` |
| Any change under `app/` | `async-api-reviewer` |
| Any change to `app/models/` or `alembic/versions/` | `migration-guard` |
| Any change to `hardware.py`, camera models, or `hardware/` | `ocr-pipeline-reviewer` |
| Any change to the rotation / break / trip / crowding services or `scheduler.py` | `scheduling-invariant-checker` |

Address every CRITICAL and HIGH finding before committing. All five are read-only by
construction — they report, they never edit, and they never merge.
