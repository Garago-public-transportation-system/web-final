# Bare-Metal Docker Topology
> **Cross-Reference**: See `PRD-v2.0.md` Section 4 & 5.7 (Constraints).

## The Production Infrastructure
Due to explicit data sovereignty blocks for governmental contractors in Cairo, all operations are isolated on local data-center servers. Docker Compose runs the stack absolutely.

## Container Matrix (`docker-compose.prod.yml`)
* `proxy`: Nginx Alpine. Points domain via port 80/443. Manages rate limit IP bans.
* `backend_api`: Python 3.13 Alpine image. Runs Uvicorn with 4 dedicated worker processes `uvicorn app.main:app --workers 4`.
* `database`: Postgres 15 Alpine. Bound explicitly to Docker persistent volumes `pgdata`.
* `redis_cache`: Redis 7 Alpine. Serves Pub/Sub messaging and SlowAPI. Must use `--appendonly yes` for persistence.\n