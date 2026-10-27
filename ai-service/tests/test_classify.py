"""
Unit tests for POST /internal/v1/classify.
Tests:
- 1. Valid in-scope classification
- 2. Valid off-topic classification
- 3. Uncertain classification
- 4. Empty or malformed message validation
- Evaluation fixtures verification
"""

import json
from pathlib import Path
from fastapi.testclient import TestClient


def test_valid_in_scope_classification(client: TestClient):
    """Test 1: Valid in-scope internet connectivity message."""
    payload = {
        "message": "My internet keeps disconnecting every few minutes",
        "allowedIssueTypes": ["internet_connectivity"],
    }
    response = client.post("/internal/v1/classify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["category"] == "internet_connectivity"
    assert 0.0 <= data["confidence"] <= 1.0
    assert data["confidence"] >= 0.70
    assert "reason" in data and len(data["reason"]) > 0


def test_valid_off_topic_classification(client: TestClient):
    """Test 2: Valid off-topic message."""
    payload = {
        "message": "Can you help me change my bank PIN?",
        "allowedIssueTypes": ["internet_connectivity"],
    }
    response = client.post("/internal/v1/classify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["category"] == "off_topic"
    assert 0.0 <= data["confidence"] <= 1.0
    assert data["confidence"] >= 0.70
    assert "reason" in data


def test_uncertain_classification(client: TestClient):
    """Test 3: Vague or ambiguous message."""
    payload = {
        "message": "It stopped working again.",
        "allowedIssueTypes": ["internet_connectivity"],
    }
    response = client.post("/internal/v1/classify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["category"] == "uncertain"
    assert 0.0 <= data["confidence"] <= 1.0
    assert data["confidence"] < 0.60
    assert "reason" in data


def test_empty_or_malformed_message_validation(client: TestClient):
    """Test 4: Empty, blank, or missing message rejected with 400."""
    # Blank string
    res1 = client.post(
        "/internal/v1/classify",
        json={"message": "   ", "allowedIssueTypes": ["internet_connectivity"]},
    )
    assert res1.status_code == 400
    assert res1.json()["error"]["code"] == "VALIDATION_ERROR"

    # Missing message
    res2 = client.post(
        "/internal/v1/classify",
        json={"allowedIssueTypes": ["internet_connectivity"]},
    )
    assert res2.status_code == 400
    assert res2.json()["error"]["code"] == "VALIDATION_ERROR"

    # Empty allowedIssueTypes
    res3 = client.post(
        "/internal/v1/classify",
        json={"message": "My internet is down", "allowedIssueTypes": []},
    )
    assert res3.status_code == 400
    assert res3.json()["error"]["code"] == "VALIDATION_ERROR"


def test_classification_eval_fixtures(client: TestClient):
    """Run all 50 classification evaluation fixtures."""
    fixtures_path = Path(__file__).parent.parent / "fixtures" / "classification_eval.json"
    assert fixtures_path.exists(), "classification_eval.json fixture not found"

    with open(fixtures_path, "r", encoding="utf-8") as f:
        cases = json.load(f)

    correct = 0
    total = len(cases)

    for item in cases:
        response = client.post(
            "/internal/v1/classify",
            json={
                "message": item["message"],
                "allowedIssueTypes": ["internet_connectivity"],
            },
        )
        assert response.status_code == 200
        category = response.json()["category"]
        if category == item["expected"]:
            correct += 1

    accuracy = correct / total
    # Mock provider should achieve > 85% accuracy on standard fixtures
    assert accuracy >= 0.85, f"Classification accuracy {accuracy:.2%} is below threshold"
