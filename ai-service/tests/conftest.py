"""
Pytest configuration and shared fixtures for the AI service tests.
Forces the deterministic mock provider and guarantees no API key or network is required.
"""

import os
import pytest
from fastapi.testclient import TestClient

# Ensure test environment uses mock provider and dummy key
os.environ["AI_PROVIDER"] = "mock"
os.environ["AI_API_KEY"] = ""
os.environ["OPENROUTER_API_KEY"] = ""

from app.main import app
from app.providers.factory import reset_provider
from app.providers.mock_provider import MockProvider


@pytest.fixture(autouse=True)
def setup_mock_provider():
    """Ensure every test uses a fresh MockProvider."""
    provider = MockProvider()
    reset_provider(provider)
    yield provider
    reset_provider(None)


@pytest.fixture
def client():
    """FastAPI TestClient fixture."""
    return TestClient(app)
