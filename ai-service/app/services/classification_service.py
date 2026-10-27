"""
Service for message classification.
Calls the active AI provider and validates output structure against the contract.
"""

from __future__ import annotations

import logging
from app.providers.factory import get_provider
from app.schemas import ClassifyRequest, ClassifyResponse, IssueCategory

logger = logging.getLogger(__name__)


class ClassificationService:
    """Orchestrates message classification via the configured AI provider."""

    def __init__(self, provider=None) -> None:
        self._provider = provider

    @property
    def provider(self):
        return self._provider or get_provider()

    async def classify(self, request: ClassifyRequest) -> ClassifyResponse:
        """Classify a message into internet_connectivity, off_topic, or uncertain."""
        try:
            result = await self.provider.classify(
                message=request.message,
                allowed_issue_types=request.allowedIssueTypes,
            )
        except Exception as e:
            logger.error(f"Provider classification error: {e}")
            raise RuntimeError(f"Classification failed: {e}") from e

        category_str = str(result.get("category", IssueCategory.UNCERTAIN.value))
        try:
            category = IssueCategory(category_str)
        except ValueError:
            category = IssueCategory.UNCERTAIN

        confidence = float(result.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))

        reason = str(result.get("reason", "Classification completed."))

        return ClassifyResponse(
            category=category,
            confidence=round(confidence, 2),
            reason=reason,
        )
