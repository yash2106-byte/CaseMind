"""
Unit tests for POST /internal/v1/match-case.
Tests:
- 5. Case match returns only a supplied candidate ID
- 6. Empty candidates return null
- 7. Similar paraphrase matches correct case
- 8. Ambiguous candidates require confirmation
- 9. Hard-negative message does not match an unrelated case
- Evaluation fixtures verification
"""

import json
from pathlib import Path
from fastapi.testclient import TestClient


def test_empty_candidates_return_null(client: TestClient):
    """Test 6: Empty candidate list returns null, 0.0 confidence, needsConfirmation=false."""
    payload = {
        "message": "My internet is still down like yesterday",
        "candidates": [],
    }
    response = client.post("/internal/v1/match-case", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["matchedCaseId"] is None
    assert data["confidence"] == 0.0
    assert data["needsConfirmation"] is False


def test_similar_paraphrase_matches_correct_case(client: TestClient):
    """Test 7: A clear paraphrase matches the corresponding unresolved case."""
    payload = {
        "message": "It is still down like yesterday",
        "candidates": [
            {
                "caseId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                "title": "Internet connection not working",
                "problemSummary": "Customer reports no internet access.",
                "status": "in_progress",
                "lastContactAt": "2026-10-18T00:00:00Z",
                "failedStepKeys": ["router_power_cycle"],
            }
        ],
    }
    response = client.post("/internal/v1/match-case", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["matchedCaseId"] == "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    assert data["confidence"] >= 0.70


def test_match_returns_only_supplied_candidate_id(client: TestClient):
    """Test 5: The returned matchedCaseId must belong to the supplied candidates."""
    candidate_id = "11111111-2222-3333-4444-555555555555"
    payload = {
        "message": "Still having connection problems",
        "candidates": [
            {
                "caseId": candidate_id,
                "title": "Connection problems",
                "problemSummary": "Connection drops frequently.",
                "status": "in_progress",
                "lastContactAt": "2026-10-18T00:00:00Z",
                "failedStepKeys": [],
            }
        ],
    }
    response = client.post("/internal/v1/match-case", json=payload)
    assert response.status_code == 200
    data = response.json()
    if data["matchedCaseId"] is not None:
        assert data["matchedCaseId"] == candidate_id


def test_ambiguous_candidates_require_confirmation(client: TestClient):
    """Test 8: When two candidates are similarly plausible, needsConfirmation is true or matchedCaseId is null."""
    payload = {
        "message": "My internet connection is down",
        "candidates": [
            {
                "caseId": "case-alpha",
                "title": "Internet connection down",
                "problemSummary": "Internet connection is down.",
                "status": "in_progress",
                "lastContactAt": "2026-10-18T00:00:00Z",
                "failedStepKeys": [],
            },
            {
                "caseId": "case-beta",
                "title": "Internet connection down",
                "problemSummary": "Internet connection is down.",
                "status": "in_progress",
                "lastContactAt": "2026-10-18T00:00:00Z",
                "failedStepKeys": [],
            },
        ],
    }
    response = client.post("/internal/v1/match-case", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["needsConfirmation"] is True or data["matchedCaseId"] is None


def test_hard_negative_does_not_match(client: TestClient):
    """Test 9: Hard negative message does not match an unrelated case."""
    payload = {
        "message": "My mobile data is slow, but home Wi-Fi works.",
        "candidates": [
            {
                "caseId": "case-wifi-001",
                "title": "Internet connection not working",
                "problemSummary": "Customer reports home broadband is down.",
                "status": "in_progress",
                "lastContactAt": "2026-10-18T00:00:00Z",
                "failedStepKeys": [],
            }
        ],
    }
    response = client.post("/internal/v1/match-case", json=payload)
    assert response.status_code == 200
    data = response.json()
    # Should not match or confidence should be below threshold
    assert data["matchedCaseId"] is None or data["confidence"] < 0.55


def test_matching_eval_fixtures(client: TestClient):
    """Run all 40 case matching evaluation fixtures."""
    fixtures_path = Path(__file__).parent.parent / "fixtures" / "matching_eval.json"
    assert fixtures_path.exists(), "matching_eval.json fixture not found"

    with open(fixtures_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    test_cases = data["test_cases"]
    correct = 0
    total = len(test_cases)

    for item in test_cases:
        res = client.post(
            "/internal/v1/match-case",
            json={
                "message": item["message"],
                "candidates": item["candidates"],
            },
        )
        assert res.status_code == 200
        result = res.json()

        if item["expect_match"]:
            if result["matchedCaseId"] == item["expected_case_id"]:
                correct += 1
        else:
            if result["matchedCaseId"] is None:
                correct += 1

    accuracy = correct / total
    assert accuracy >= 0.80, f"Case matching accuracy {accuracy:.2%} is below threshold"
