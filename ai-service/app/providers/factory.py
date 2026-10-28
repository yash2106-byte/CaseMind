"""
Factory for resolving the active AI provider based on configuration.
"""

from __future__ import annotations

import logging
from app.config import settings
from app.providers.base import BaseProvider
from app.providers.mock_provider import MockProvider
from app.providers.openrouter_provider import OpenRouterProvider

logger = logging.getLogger(__name__)

_provider_instance: BaseProvider | None = None


def get_provider() -> BaseProvider:
    """Return the singleton instance of the configured provider."""
    global _provider_instance
    if _provider_instance is not None:
        return _provider_instance

    provider_name = settings.ai_provider.lower().strip()
    if provider_name in ("openrouter", "free_tier", "llm"):
        logger.info(f"Using OpenRouterProvider with model '{settings.ai_model}'")
        _provider_instance = OpenRouterProvider()
    else:
        logger.info("Using deterministic MockProvider")
        _provider_instance = MockProvider()

    return _provider_instance


def reset_provider(provider: BaseProvider | None = None) -> None:
    """Allow tests to inject or reset the active provider."""
    global _provider_instance
    _provider_instance = provider
