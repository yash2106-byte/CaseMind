"""
Endpoint for outcome extraction: POST /internal/v1/extract-outcome
"""

from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas import ExtractOutcomeRequest, ExtractOutcomeResponse
from app.services.outcome_service import OutcomeService

router = APIRouter(prefix="/internal/v1", tags=["outcome"])


def get_outcome_service() -> OutcomeService:
    return OutcomeService()


@router.post(
    "/extract-outcome",
    response_model=ExtractOutcomeResponse,
    status_code=status.HTTP_200_OK,
    summary="Extract troubleshooting outcome",
    description="Extracts whether the customer reports failed, succeeded, unknown, or not_provided for the current step.",
)
async def extract_outcome(
    request: ExtractOutcomeRequest,
    service: OutcomeService = Depends(get_outcome_service),
) -> ExtractOutcomeResponse:
    try:
        return await service.extract_outcome(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AI_UNAVAILABLE", "message": str(e)},
        ) from e
