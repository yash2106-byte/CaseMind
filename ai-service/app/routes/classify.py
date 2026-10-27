"""
Endpoint for message classification: POST /internal/v1/classify
"""

from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas import ClassifyRequest, ClassifyResponse
from app.services.classification_service import ClassificationService

router = APIRouter(prefix="/internal/v1", tags=["classification"])


def get_classification_service() -> ClassificationService:
    return ClassificationService()


@router.post(
    "/classify",
    response_model=ClassifyResponse,
    status_code=status.HTTP_200_OK,
    summary="Classify customer message",
    description="Classifies whether a message is about internet connectivity, off-topic, or uncertain.",
)
async def classify_message(
    request: ClassifyRequest,
    service: ClassificationService = Depends(get_classification_service),
) -> ClassifyResponse:
    try:
        return await service.classify(request)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AI_UNAVAILABLE", "message": str(e)},
        ) from e
