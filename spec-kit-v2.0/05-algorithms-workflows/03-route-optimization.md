# Mathematical Reroute Workflow
> **Cross-Reference**: See `PRD-v2.0.md` Section 5.3 (Route Management).

## Deviation & Approval Heuristics
Drivers operating in severe traffic blockades request path deviations. The backend math enforces validation to prevent malicious joyriding.

```python
import math

def calculate_euclidean(lat1, lng1, lat2, lng2):
    # Standard Haversine formula implemented here
    pass

def evaluate_reroute_request(original_route_dist: float, new_route_dist: float) -> str:
    diff = abs(original_route_dist - new_route_dist)
    deviation_percent = diff / original_route_dist
    
    if deviation_percent <= 0.20:
        return "AUTO_APPROVED"
    return "PENDING_DISPATCHER"
```
Auto-approved routines instantly update the driver's tablet UI with the new vector. Manual interventions are flagged on the Dispatcher dashboard.\n