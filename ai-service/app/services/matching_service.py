"""
Service for case matching.
Ensures candidate ID constraints and confidence threshold policy are strictly enforced.
"""

from __future__ import annotations

import logging
from app.providers.factory import get_provider
from app.schemas import MatchCaseRequest, MatchCaseResponse

logger = logging.getLogger(__name__)


class MatchingService:
    """Orchestrates case matching and applies authoritative contract rules."""

    def __init__(self, provider=None) -> None:
        self._provider = provider

    @property
    def provider(self):
        return self._provider or get_provider()

    async def match_case(self, request: MatchCaseRequest) -> MatchCaseResponse:
        """
        Suggest which candidate case the message refers to.
        Applies rules from Section 6 and Section 9.2 of the Shared Contract:
        - If candidates list is empty, return null with confidence 0.0
        - matchedCaseId must be in the supplied candidate list
        - Thresholds:
            confidence >= 0.80: strong suggestion, needsConfirmation=false
            0.55 <= confidence < 0.80: needsConfirmation=true
            confidence < 0.55: no confident match, matchedCaseId=null
        """
        if not request.candidates:
            return MatchCaseResponse(
                matchedCaseId=None,
                confidence=0.0,
                needsConfirmation=False,
                reason="No candidate cases provided.",
            )

        valid_candidate_ids = {c.caseId for c in request.candidates}
        candidates_data = [c.model_dump() for c in request.candidates]

        try:
            result = await self.provider.match_case(
                message=request.message,
                candidates=candidates_data,
            )
        except Exception as e:
            logger.error(f"Provider match_case error: {e}")
            raise RuntimeError(f"Case matching failed: {e}") from e

        matched_id = result.get("matchedCaseId")
        if matched_id and matched_id not in valid_candidate_ids:
            logger.warning(
                f"Provider suggested unknown case ID '{matched_id}' not in candidates. Coercing to null."
            )
            matched_id = None

        confidence = float(result.get("confidence", 0.0))
        confidence = max(0.0, min(1.0, confidence))

        needs_confirmation = bool(result.get("needsConfirmation", False))

        # Enforce contract threshold policy
        if confidence >= 0.80 and matched_id is not None:
            needs_confirmation = False
        elif 0.55 <= confidence < 0.80 and matched_id is not None:
            needs_confirmation = True
        elif confidence < 0.55:
            matched_id = None
            needs_confirmation = False

        reason = str(result.get("reason", "Case matching completed."))

        return MatchCaseResponse(
            matchedCaseId=matched_id,
            confidence=round(confidence, 2),
            needsConfirmation=needs_confirmation,
            reason=reason,
        )
