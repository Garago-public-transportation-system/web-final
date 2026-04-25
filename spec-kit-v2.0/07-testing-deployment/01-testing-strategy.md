# Advanced Testing Operations
> **Cross-Reference**: See `PRD-v2.0.md` Section 6 (Acceptance Criteria).

## Quantitative Coverage
The CI pipeline strictly blocks merges if code coverage drops below `80%`.

## Backend Framework (`pytest-asyncio`)
All unit tests operate on specific `fixture` overrides to ensure they don't corrupt development databases.
```python
@pytest.fixture
async def override_get_db():
    # Setup completely isolated in-memory or transient SQLite/Postgres DB
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    # ...
```
**Critical Test Scenarios**:
* `test_ping_pong_logic_fails_on_high_fatigue`: Verify APScheduler refuses to assign a driver with >90 score.
* `test_yolo_webhook_triggers_websocket`: Validating that posting to the IoT endpoint correctly fires the mocked Redis publish command.\n