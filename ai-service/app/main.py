"""
FastAPI entry point for the AI service.
Internal service listening on port 8000 for backend requests.
"""

from __future__ import annotations

import logging
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.routes.classify import router as classify_router
from app.routes.extract_outcome import router as outcome_router
from app.routes.match_case import router as match_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai_service")

app = FastAPI(
    title="Case Continuity Engine — AI Service",
    description="Internal NLP/AI service providing classification, case matching, and outcome extraction.",
    version="1.0.0",
)

# ── Include Routers ───────────────────────────────────────────────────────────
app.include_router(classify_router)
app.include_router(match_router)
app.include_router(outcome_router)


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["system"], summary="Health check")
@app.get("/internal/v1/health", tags=["system"], summary="Internal health check")
async def health():
    return {"status": "ok"}


# ── Custom Error Handlers (Contract Section 7.11) ─────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Formats validation errors to match the shared contract error envelope."""
    errors = exc.errors()
    first_err = errors[0] if errors else {}
    msg = first_err.get("msg", "Invalid request body")
    loc = ".".join(str(x) for x in first_err.get("loc", []))
    detailed_msg = f"{loc}: {msg}" if loc else msg

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": detailed_msg,
            }
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Formats HTTP exceptions to match the shared contract error envelope."""
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        code = exc.detail.get("code", "INTERNAL_ERROR")
        message = exc.detail.get("message", str(exc.detail))
    else:
        code = "AI_UNAVAILABLE" if exc.status_code == 503 else "INTERNAL_ERROR"
        message = str(exc.detail)

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": message,
            }
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Catch-all unhandled error handler."""
    logger.exception("Unhandled server exception")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred in the AI service.",
            }
        },
    )
