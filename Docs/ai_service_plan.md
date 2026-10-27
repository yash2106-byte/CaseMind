# AI Service Implementation Plan

## Overview
Build the Python FastAPI AI service for the CaseMind Case Continuity Engine. The service handles **3 internal endpoints** called only by the Node.js backend:

1. **`POST /internal/v1/classify`** — Classify customer messages as `internet_connectivity`, `off_topic`, or `uncertain`
2. **`POST /internal/v1/match-case`** — Suggest which existing case a message refers to
3. **`POST /internal/v1/extract-outcome`** — Extract troubleshooting outcome from customer messages

## Key Constraints
- **No database access** — the AI service is stateless
- **No browser calls** — only the backend talks to this service
- **Mock provider by default** — deterministic fake for tests, optional free-tier LLM for demos
- **Port 8000** — reachable at `http://ai-service:8000` inside Docker Compose

## Implementation Steps

### Phase 1: Project Structure & Core Setup
- Create `ai-service/` directory with the suggested structure
- `requirements.txt` with FastAPI, uvicorn, pydantic, pytest, httpx
- `app/main.py` — FastAPI app with health endpoint
- `app/schemas.py` — All Pydantic request/response models
- `.env.example` and `Dockerfile`

### Phase 2: Provider Abstraction
- `app/providers/base.py` — Abstract base class
- `app/providers/mock_provider.py` — Deterministic keyword-based provider
- `app/providers/free_tier_provider.py` — Optional Groq/Google free-tier adapter

### Phase 3: Service Logic
- `app/services/classification_service.py` — Classify messages
- `app/services/matching_service.py` — Match messages to cases
- `app/services/outcome_service.py` — Extract outcomes

### Phase 4: Routes
- `app/routes/classify.py`
- `app/routes/match_case.py`
- `app/routes/extract_outcome.py`

### Phase 5: Evaluation Fixtures
- Classification: 20 in-scope + 20 off-topic + 10 uncertain
- Matching: 20 paraphrases + 20 hard negatives
- Outcome: 20 examples across all 4 outcomes

### Phase 6: Tests
- 16+ required test cases per the PRD
- All running offline with mock provider

### Phase 7: Documentation
- README with run/test/configure instructions
