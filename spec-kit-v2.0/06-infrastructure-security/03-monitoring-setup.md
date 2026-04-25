# Prometheus / Grafana Observability
> **Cross-Reference**: See `PRD-v2.0.md` Architecture Layer.

## Instrumentation Pipeline
We utilize `prometheus-fastapi-instrumentator`.
```python
from prometheus_fastapi_instrumentator import Instrumentator
# In main.py
Instrumentator().instrument(app).expose(app)
```
## Required Grafana Dashboards
You must establish the following 3 graphical panels post-deployment:
1. **Fleet Status Ring**: Aggregating `vehicles` table grouped by `status` (ON_ROUTE, MAINTENANCE).
2. **WebSocket Load Line**: Tracking active concurrent connection keys in Redis.
3. **HTTP 95th Percentiles**: A histogram representing REST latency, strictly monitored to ensure it stays below the 200ms PRD constraint.\n