---
description: Run the full Garago review board over the current diff — RBAC, async, migrations, OCR, scheduling invariants.
---

Review the current changes against this project's standing rules.

## 1. Establish the diff

```bash
git status --short
git diff HEAD
```

If there is nothing uncommitted, review the last commit instead (`git show HEAD`).

## 2. Route to the right reviewers

Look at which paths changed and launch **in parallel** every agent whose trigger
matches. Do not run them one at a time — they are independent and read-only.

| Changed path | Agent |
|---|---|
| `app/api/**`, `app/api/deps.py`, `app/core/security.py` | `rbac-auditor` |
| `app/**` (any) | `async-api-reviewer` |
| `app/models/**`, `alembic/versions/**` | `migration-guard` |
| `app/api/v1/hardware.py`, camera models, `hardware/**` | `ocr-pipeline-reviewer` |
| `app/services/rotation_service.py`, `break_service.py`, `trip_service.py`, `crowding_service.py`, `scheduler.py` | `scheduling-invariant-checker` |

If nothing under `app/` changed, say so and stop — do not invent work.

## 3. Local gates

Run alongside the agents:

```bash
python -m py_compile $(git diff --name-only HEAD | grep '\.py$')   # syntax
grep -rnE '(password|secret|api_key|token)\s*=\s*["'"'"'][^"'"'"']{8,}' \
  --include='*.py' --include='*.ini' app/ *.py                      # hardcoded secrets
git diff HEAD --name-only | grep -q '^\.env$' && echo 'BLOCK: .env is staged'
```

## 4. Report

Merge the findings into one list, most severe first, deduplicated where two agents
found the same thing. For each: `file:line — what — consequence — fix`.

Close with a single verdict:

- **PASS** — no CRITICAL or HIGH findings.
- **CHANGES REQUESTED** — HIGH findings only.
- **BLOCK** — any CRITICAL finding.

Then stop. Do not apply the fixes unless asked, and never commit, push, or merge —
the human decides what ships.
