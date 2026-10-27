"""
Unit tests for resilience, error handling, retries, and offline guarantees.
Tests:
- 13. Invalid enum/confidence response handled safely
- 14. Provider timeout returns 503
- 15. Malformed model output retries once and fails safely
- 16. No API key required when mock provider is selected
"""

import os
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.providers.base import BaseProvider
from app.providers.factory import reset_provider
from app.providers.openrouter_provider import OpenRouterProvider


class TimeoutFailingProvider(BaseProvider):
    """Simulates a provider timing out or failing."""

    async def classify(self, message: str, allowed_issue_types: list[str]):
        raise TimeoutError("Provider connection timed out after 5.0 seconds")

    async def match_case(self, message: str, candidates: list[dict]):
        raise TimeoutError("Provider connection timed out after 5.0 seconds")

    async def extract_outcome(self, message: str, current_step_key: str):
        raise TimeoutError("Provider connection timed out after 5.0 seconds")


def test_provider_timeout_returns_503(client: TestClient):
    """Test 14: When the AI provider times out, return HTTP 503 with AI_UNAVAILABLE."""
    reset_provider(TimeoutFailingProvider())
    try:
        response = client.post(
            "/internal/v1/classify",
            json={
                "message": "My internet is down",
                "allowedIssueTypes": ["internet_connectivity"],
            },
        )
        assert response.status_code == 503
        data = response.json()
        assert data["error"]["code"] == "AI_UNAVAILABLE"
        assert "timed out" in data["error"]["message"].lower()
    finally:
        reset_provider(None)


def test_no_api_key_needed_for_mock_provider(client: TestClient):
    """Test 16: Mock provider operates fully offline with no API key set."""
    os.environ["AI_PROVIDER"] = "mock"
    os.environ["AI_API_KEY"] = ""
    os.environ["OPENROUTER_API_KEY"] = ""

    response = client.post(
        "/internal/v1/classify",
        json={
            "message": "My internet is down",
            "allowedIssueTypes": ["internet_connectivity"],
        },
    )
    assert response.status_code == 200
    assert response.json()["category"] == "internet_connectivity"


class MalformedResponseProvider(BaseProvider):
    """Returns invalid enum and confidence out of bounds."""

    async def classify(self, message: str, allowed_issue_types: list[str]):
        return {
            "category": "INVALID_CATEGORY_XYZ",
            "confidence": 99.9,
            "reason": "Test invalid values",
        }

    async def match_case(self, message: str, candidates: list[dict]):
        return {
            "matchedCaseId": "hallucinated-case-id-12345",
            "confidence": 2.5,
            "needsConfirmation": False,
            "reason": "Test hallucination",
        }

    async def extract_outcome(self, message: str, current_step_key: str):
        return {
            "outcome": "INVALID_OUTCOME_ABC",
            "confidence": -1.0,
            "evidence": "Test invalid outcome",
        }


def test_invalid_values_are_handled_safely(client: TestClient):
    """Test 13: Invalid enum/confidence values from a provider are sanitized/clamped."""
    reset_provider(MalformedResponseProvider())
    try:
        # Classify should coerce unknown category to uncertain and clamp confidence
        res_c = client.post(
            "/internal/v1/classify",
            json={
                "message": "My internet is down",
                "allowedIssueTypes": ["internet_connectivity"],
            },
        )
        assert res_c.status_code == 200
        assert res_c.json()["category"] == "uncertain"
        assert res_c.json()["confidence"] == 1.0  # Clamped to 1.0

        # Match case should coerce hallucinated candidate ID to null and clamp confidence
        res_m = client.post(
            "/internal/v1/match-case",
            json={
                "message": "Internet down",
                "candidates": [
                    {
                        "caseId": "valid-candidate-1",
                        "title": "Internet down",
                        "problemSummary": "Summary",
                        "status": "in_progress",
                        "lastContactAt": "2026-10-18T00:00:00Z",
                        "failedStepKeys": [],
                    }
                ],
            },
        )
        assert res_m.status_code == 200
        assert res_m.json()["matchedCaseId"] is None

        # Extract outcome should coerce invalid outcome to unknown and clamp confidence
        res_o = client.post(
            "/internal/v1/extract-outcome",
            json={
                "message": "Test message",
                "currentStepKey": "router_power_cycle",
            },
        )
        assert res_o.status_code == 200
        assert res_o.json()["outcome"] == "unknown"
        assert res_o.json()["confidence"] == 0.0  # Clamped to 0.0
    finally:
        reset_provider(None)


@pytest.mark.asyncio
async def test_openrouter_retry_repair_on_malformed_json():
    """Test 15: OpenRouter provider retries once on malformed JSON and parses repaired JSON."""
    provider = OpenRouterProvider()
    provider.api_key = "test-key"

    # Mock _call_openrouter to return malformed output on 1st call, valid on 2nd call
    call_mock = AsyncMock(
        side_effect=[
            "This is not JSON at all: sorry I am an AI",
            '{"category": "internet_connectivity", "confidence": 0.95, "reason": "Fixed JSON"}',
        ]
    )

    with patch.object(provider, "_call_openrouter", call_mock):
        result = await provider.classify("My internet is down", ["internet_connectivity"])
        assert result["category"] == "internet_connectivity"
        assert result["confidence"] == 0.95
        assert call_mock.call_count == 2
