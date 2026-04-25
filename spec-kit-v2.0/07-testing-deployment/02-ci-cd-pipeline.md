# GitHub Actions Integration Automation
> **Cross-Reference**: See `PRD-v2.0.md` CI/CD Pipeline constraints.

## Flow Triggers
Any push to `main` executes:
1. `checkout@v3`
2. Installation of Python 3.13 + dependencies.
3. `ruff check .` -> Fails if linting/formatting is poor.
4. `pytest` -> Validates the 80% coverage math thresholds.
5. If successful: Executes secure SSH script into the Cairo test-server cluster and re-pulls the docker images.

## Example Configuration
```yaml
name: V2 Deployment Security Pipe
on: [push]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python 3.13
        uses: actions/setup-python@v4
        with: { python-version: '3.13' }
      - run: pip install -r requirements.txt
      - run: ruff check .
      - run: pytest --cov=app --cov-fail-under=80
```\n