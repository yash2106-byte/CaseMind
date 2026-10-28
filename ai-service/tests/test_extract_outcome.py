"""
Unit tests for POST /internal/v1/extract-outcome.
Tests:
- 10. All outcome values are handled (failed, succeeded, unknown, not_provided)
- 11. Explicit success is required for `succeeded`
- 12. Attempting a step is not automatically success
- Evaluation fixtures verification
"""

import json
from pathlib import Path
from fastapi.testclient import TestClient


def test_failed_outcome_extraction(client: TestClient):
    """Test 10a: Extracting failed outcome."""
    payload = {
        "message": "I tried it but the internet is still down",
        "currentStepKey": "router_power_cycle",
    }
    response = client.post("/internal/v1/extract-outcome", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["outcome"] == "failed"
    assert data["confidence"] >= 0.70
    assert "evidence" in data


def test_succeeded_outcome_extraction(client: TestClient):
    """Test 10b & 11: Explicit success statement required for succeeded."""
    payload = {
        "message": "It works now and I can browse again! Problem solved.",
        "currentStepKey": "router_power_cycle",
    }
    response = client.post("/internal/v1/extract-outcome", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["outcome"] == "succeeded"
    assert data["confidence"] >= 0.80


def test_attempting_step_is_not_automatically_success(client: TestClient):
    """Test 12: 'I turned it off and on' is NOT success."""
    payload = {
        "message": "I turned it off and on.",
        "currentStepKey": "router_power_cycle",
    }
    response = client.post("/internal/v1/extract-outcome", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["outcome"] != "succeeded", "Merely attempting a step must not be considered success"
    assert data["outcome"] in ("unknown", "not_provided")


def test_unknown_outcome_extraction(client: TestClient):
    """Test 10c: Unclear or untested result returns unknown."""
    payload = {
        "message": "The lights are different, but I haven't tested it yet.",
        "currentStepKey": "router_power_cycle",
    }
    response = client.post("/internal/v1/extract-outcome", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["outcome"] == "unknown"


def test_not_provided_outcome_extraction(client: TestClient):
    """Test 10d: Unrelated message with no outcome returns not_provided."""
    payload = {
        "message": "Where is the power button located on the router?",
        "currentStepKey": "router_power_cycle",
    }
    response = client.post("/internal/v1/extract-outcome", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["outcome"] == "not_provided"


def test_outcome_eval_fixtures(client: TestClient):
    """Run all 20 outcome extraction evaluation fixtures."""
    fixtures_path = Path(__file__).parent.parent / "fixtures" / "outcome_eval.json"
    assert fixtures_path.exists(), "outcome_eval.json fixture not found"

    with open(fixtures_path, "r", encoding="utf-8") as f:
        items = json.load(f)

    correct = 0
    total = len(items)

    for item in items:
        res = client.post(
            "/internal/v1/extract-outcome",
            json={
                "message": item["message"],
                "currentStepKey": item["currentStepKey"],
            },
        )
        assert res.status_code == 200
        outcome = res.json()["outcome"]
        if outcome == item["expected_outcome"]:
            correct += 1

    accuracy = correct / total
    assert accuracy >= 0.85, f"Outcome extraction accuracy {accuracy:.2%} is below threshold"
