# Master Logic: "Ping-Pong" Driver Rotation
> **Cross-Reference**: See `PRD-v2.0.md` Section 5.1 (Driver Management).

## The Core Concept
The standard "linear" single-driver path results in massive fatigue in Cairo traffic. We institute a "Ping-Pong" loop for each distinct route, utilizing exactly 3 drivers (D1, D2, D3).

* **Stage 1**: D1 takes Bus A outbound. D2 takes Bus B inbound. D3 rests.
* **Stage 2**: D3 begins shift staggered by 1-hour. D3 intercepts Bus A. D1 takes a mandatory uninterrupted 2-hour rest interval.
* **Stage 3**: D1 is rotated into Bus B, relieving D2.

## The Algorithmic Fatigue Function
The backend calculates assignments via a highly explicit mathematical function stored in `rotation_service.py`.

```python
def check_driver_fatigue(driver_id: int, consecutive_hours: float, traffic_density_multiplier: float) -> int:
    score = 0
    # Legal threshold limits
    if consecutive_hours > 4:
        score += 35
    elif consecutive_hours > 2:
        score += 15
        
    # Apply complex routing stressors
    score = int(score * traffic_density_multiplier)
    
    return min(score, 100) # Caps at absolute limit
```
If `score >= 90`, the backend APScheduler refuses to attach the driver to any new `RotationAssignment` and flags them `STATUS=FATIGUED`.\n