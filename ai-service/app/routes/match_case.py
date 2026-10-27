"""
Endpoint for case matching: POST /internal/v1/match-case
"""

from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas import MatchCaseRequest, MatchCaseResponse
from app.services.matching_service import MatchingService

router = APIRouter(prefix="/internal/v1", tags=["matching"])


def get_matching_service() -> MatchingService:
    return MatchingService()


@router.post(
    "/match-case",
    response_model=MatchCaseResponse,
    status_code=status.HTTP_200_OK,
    summary="Match message to candidate cases",
    description="Suggests which candidate unresolved case a message refers to.",
)
async def match_case(
    request: MatchCaseRequest,
    service: MatchingService = Depends(get_matching_service),
) -> MatchCaseResponse:
    try:
        return await service.match_case(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AI_UNAVAILABLE", "message": str(e)},
        ) from e
