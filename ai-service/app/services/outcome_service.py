"""
Service for troubleshooting outcome extraction.
Extracts and validates customer outcomes: failed, succeeded, unknown, or not_provided.
"""

from __future__ import annotations

import logging
from app.providers.factory import get_provider
from app.schemas import ExtractOutcomeRequest, ExtractOutcomeResponse, OutcomeValue

logger = logging.getLogger(__name__)


class OutcomeService:
    """Orchestrates troubleshooting outcome extraction."""

    def __init__(self, provider=None) -> None:
        self._provider = provider

    @property
    def provider(self):
        return self._provider or get_provider()

    async def extract_outcome(
        self, request: ExtractOutcomeRequest
    ) -> ExtractOutcomeResponse:
        """
        Extract whether customer reported failed, succeeded, unknown, or not_provided.
        """
        try:
            result = await self.provider.extract_outcome(
                message=request.message,
                current_step_key=request.currentStepKey,
            )
        except Exception as e:
            logger.error(f"Provider extract_outcome error: {e}")
            raise RuntimeError(f"Outcome extraction failed: {e}") from e

        outcome_str = str(result.get("outcome", OutcomeValue.UNKNOWN.value))
        try:
            outcome = OutcomeValue(outcome_str)
        except ValueError:
            outcome = OutcomeValue.UNKNOWN

        confidence = float(result.get("confidence", 0.5))
        confidence = max(0.0, min(1.0, confidence))

        evidence = str(result.get("evidence", "Outcome extracted from message."))

        return ExtractOutcomeResponse(
            outcome=outcome,
            confidence=round(confidence, 2),
            evidence=evidence,
        )
