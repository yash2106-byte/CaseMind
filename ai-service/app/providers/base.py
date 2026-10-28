"""
Abstract base class for AI providers.
Every provider must implement classify, match_case, and extract_outcome.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseProvider(ABC):
    """
    Abstract AI provider interface.
    Concrete implementations include the deterministic mock provider
    and optional free-tier LLM adapters.
    """

    @abstractmethod
    async def classify(self, message: str, allowed_issue_types: list[str]) -> dict[str, Any]:
        """
        Classify a customer message.

        Returns:
            dict with keys: category, confidence, reason
        """
        ...

    @abstractmethod
    async def match_case(
        self, message: str, candidates: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """
        Suggest which candidate case the message refers to.

        Returns:
            dict with keys: matchedCaseId, confidence, needsConfirmation, reason
        """
        ...

    @abstractmethod
    async def extract_outcome(
        self, message: str, current_step_key: str
    ) -> dict[str, Any]:
        """
        Extract whether the customer reports an outcome for the current step.

        Returns:
            dict with keys: outcome, confidence, evidence
        """
        ...
