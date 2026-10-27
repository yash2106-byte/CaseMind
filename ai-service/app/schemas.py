"""
Pydantic schemas for all request/response models.
Matches the Shared Contract (Section 9) exactly.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ─── Enums ────────────────────────────────────────────────────────────────────


class IssueCategory(str, Enum):
    """Classification result categories."""
    INTERNET_CONNECTIVITY = "internet_connectivity"
    OFF_TOPIC = "off_topic"
    UNCERTAIN = "uncertain"


class OutcomeValue(str, Enum):
    """Possible outcome extraction results."""
    FAILED = "failed"
    SUCCEEDED = "succeeded"
    UNKNOWN = "unknown"
    NOT_PROVIDED = "not_provided"


# ─── Classify ─────────────────────────────────────────────────────────────────


class ClassifyRequest(BaseModel):
    """Request body for POST /internal/v1/classify."""
    message: str = Field(..., min_length=1, description="Customer message to classify")
    allowedIssueTypes: list[str] = Field(
        ...,
        min_length=1,
        description="Issue types the system currently supports",
    )

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message must not be blank")
        return v


class ClassifyResponse(BaseModel):
    """Response body for POST /internal/v1/classify."""
    category: IssueCategory
    confidence: float = Field(..., ge=0.0, le=1.0)
    reason: str


# ─── Match Case ───────────────────────────────────────────────────────────────


class CaseCandidate(BaseModel):
    """A candidate case supplied by the backend for matching."""
    caseId: str
    title: str
    problemSummary: str
    status: str
    lastContactAt: str
    failedStepKeys: list[str] = Field(default_factory=list)


class MatchCaseRequest(BaseModel):
    """Request body for POST /internal/v1/match-case."""
    message: str = Field(..., min_length=1, description="Customer message to match")
    candidates: list[CaseCandidate] = Field(
        default_factory=list,
        description="Unresolved cases for this customer",
    )

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message must not be blank")
        return v


class MatchCaseResponse(BaseModel):
    """Response body for POST /internal/v1/match-case."""
    matchedCaseId: Optional[str] = None
    confidence: float = Field(..., ge=0.0, le=1.0)
    needsConfirmation: bool = False
    reason: str


# ─── Extract Outcome ──────────────────────────────────────────────────────────


class ExtractOutcomeRequest(BaseModel):
    """Request body for POST /internal/v1/extract-outcome."""
    message: str = Field(..., min_length=1, description="Customer message")
    currentStepKey: str = Field(
        ..., min_length=1, description="The playbook step currently active"
    )

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message must not be blank")
        return v


class ExtractOutcomeResponse(BaseModel):
    """Response body for POST /internal/v1/extract-outcome."""
    outcome: OutcomeValue
    confidence: float = Field(..., ge=0.0, le=1.0)
    evidence: str


# ─── Error ────────────────────────────────────────────────────────────────────


class ErrorDetail(BaseModel):
    """Standard error response body."""
    code: str
    message: str
    requestId: Optional[str] = None


class ErrorResponse(BaseModel):
    """Wrapper for error responses."""
    error: ErrorDetail
