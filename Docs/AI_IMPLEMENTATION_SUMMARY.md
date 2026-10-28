# CaseMind — AI Service Implementation Summary

**Author:** AI Engineer  
**Stack:** Python 3.12 + FastAPI + Pydantic v2 + httpx + pytest  
**LLM Support:** OpenRouter Free AI Models (`meta-llama/llama-3.3-70b-instruct:free`, `google/gemini-2.0-flash-exp:free`, etc.) + Offline Deterministic Mock Provider  
**Authoritative Contracts:** [`Docs/00_SHARED_CONTRACT.md`](Docs/00_SHARED_CONTRACT.md) & [`Docs/02_AI_PRD.md`](Docs/02_AI_PRD.md)

---

## 1. Executive Summary

The **AI Service** (`ai-service/`) is an internal microservice designed to assist the Case Continuity Engine with natural language understanding. It fulfills three critical responsibilities:

1. **Intent Classification (`/classify`):** Categorizes customer messages into `internet_connectivity`, `off_topic`, or `uncertain`.
2. **Case Matching (`/match-case`):** Suggests whether an incoming message from a returning customer refers to an existing unresolved case.
3. **Troubleshooting Outcome Extraction (`/extract-outcome`):** Interprets free-form responses to determine if a troubleshooting step succeeded, failed, is unknown, or has no stated outcome.

### Strict Architectural Boundaries
- **No Database Access:** The AI service does **not** connect to PostgreSQL; it is fully stateless.
- **Backend Authority:** The Node.js backend remains the sole authority for persisting cases, tracking contact counts, deciding playbook steps, and escalating. The AI service provides suggestions only.
- **No Direct Browser Access:** Only the backend communicates with the AI service via internal HTTP (`http://ai-service:8000` or `http://localhost:8000`).

---

## 2. Directory Structure

```text
ai-service/
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI application & Section 7.11 error handlers
│   ├── config.py                   # Pydantic Settings (OpenRouter & mock settings)
│   ├── schemas.py                  # Pydantic v2 schemas for all requests/responses
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py                 # Abstract base class BaseProvider
│   │   ├── mock_provider.py        # Deterministic offline keyword/similarity provider
│   │   ├── openrouter_provider.py  # OpenRouter free AI models provider with retry repair
│   │   ├── free_tier_provider.py   # Backward-compatible alias
│   │   └── factory.py              # Provider resolution singleton
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── classify.py             # POST /internal/v1/classify
│   │   ├── match_case.py           # POST /internal/v1/match-case
│   │   └── extract_outcome.py      # POST /internal/v1/extract-outcome
│   └── services/
│       ├── __init__.py
│       ├── classification_service.py
│       ├── matching_service.py
│       └── outcome_service.py
├── fixtures/
│   ├── classification_eval.json    # 50 test examples (20 in-scope, 20 off-topic, 10 uncertain)
│   ├── matching_eval.json          # 40 test examples (20 positive paraphrases, 20 hard negatives)
│   └── outcome_eval.json           # 20 test examples across all 4 outcome states
├── tests/
│   ├── __init__.py
│   ├── conftest.py                 # Pytest fixtures ensuring offline mock provider execution
│   ├── test_classify.py            # Unit tests & eval fixture runner for classify
│   ├── test_match_case.py          # Unit tests & eval fixture runner for match-case
│   ├── test_extract_outcome.py     # Unit tests & eval fixture runner for extract-outcome
│   └── test_resilience.py          # Timeouts (503), malformed JSON retry, sanitization
├── .env.example                    # Environment variable template
├── Dockerfile                      # Production container image definition
├── requirements.txt                # Python dependencies
└── README.md                       # Service guide and instructions
```

---

## 3. Endpoints Specification (Shared Contract Section 9)

### 3.1 `POST /internal/v1/classify`
Classifies whether a message relates to an allowed issue type (`internet_connectivity`), is off-topic, or is uncertain.

- **Request:**
  ```json
  {
    "message": "My Wi-Fi keeps disconnecting every few minutes",
    "allowedIssueTypes": ["internet_connectivity"]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "category": "internet_connectivity",
    "confidence": 0.95,
    "reason": "The message describes an internet connectivity problem."
  }
  ```
- **Allowed Categories:** `internet_connectivity`, `off_topic`, `uncertain`.

---

### 3.2 `POST /internal/v1/match-case`
Suggests which unresolved candidate case the user is referring to.

- **Request:**
  ```json
  {
    "message": "It is still down like yesterday",
    "candidates": [
      {
        "caseId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "title": "Internet connection not working",
        "problemSummary": "Customer reports no internet access.",
        "status": "in_progress",
        "lastContactAt": "2026-10-18T00:00:00Z",
        "failedStepKeys": ["router_power_cycle"]
      }
    ]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "matchedCaseId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "confidence": 0.91,
    "needsConfirmation": false,
    "reason": "Strong match based on message similarity to the case description."
  }
  ```
- **Contract Rules Enforced:**
  - `matchedCaseId` is guaranteed to be one of the candidate IDs or `null`.
  - Empty candidate list returns `matchedCaseId: null`, `confidence: 0.0`, `needsConfirmation: false`.
  - Threshold policy: `>= 0.80` auto-match, `0.55 <= conf < 0.80` requires user confirmation (`needsConfirmation: true`), `< 0.55` returns `matchedCaseId: null`.

---

### 3.3 `POST /internal/v1/extract-outcome`
Evaluates whether customer's reply indicates the troubleshooting step worked, failed, was attempted but unclear, or did not state an outcome.

- **Request:**
  ```json
  {
    "message": "I tried it but the internet is still down",
    "currentStepKey": "router_power_cycle"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "outcome": "failed",
    "confidence": 0.94,
    "evidence": "Customer indicates the step did not resolve the issue: 'still down' detected."
  }
  ```
- **Allowed Outcomes:** `failed`, `succeeded`, `unknown`, `not_provided`.
- **Key Rules:**
  - "I restarted it" is NOT success (`unknown` or `not_provided`).
  - Explicit confirmation (e.g. "it works now", "fixed") is strictly required for `succeeded`.

---

### 3.4 `GET /health` & `GET /internal/v1/health`
Health check endpoints returning `{"status": "ok"}`.

---

### 3.5 Error Envelope (Shared Contract Section 7.11)
All error responses strictly follow the standard format:
```json
{
  "error": {
    "code": "VALIDATION_ERROR | AI_UNAVAILABLE | INTERNAL_ERROR",
    "message": "Detailed error description"
  }
}
```

---

## 4. Providers & OpenRouter Integration

The service includes two providers selected via `.env`:

### 4.1 OpenRouter Free AI Models (`AI_PROVIDER=openrouter`)
Uses OpenRouter's free AI models through `httpx.AsyncClient`:
- **Recommended Free Models:**
  - `meta-llama/llama-3.3-70b-instruct:free` (Default)
  - `google/gemini-2.0-flash-exp:free`
  - `mistralai/mistral-7b-instruct:free`
  - `deepseek/deepseek-r1:free`
- **Features:**
  - Requests JSON output formatting.
  - Automatic extraction of JSON from markdown code blocks (` ```json ... ``` `).
  - **Self-Repair Retry:** If the model returns malformed JSON, retries once with a correction instruction before failing safely.
  - Hard constraint validation on candidate IDs and enum values.

### 4.2 Deterministic Mock Provider (`AI_PROVIDER=mock`)
- Default for offline execution and unit testing.
- Uses keyword analysis and Python's `difflib.SequenceMatcher` to evaluate text similarity.
- Requires **zero API keys** and **no network connection**.

---

## 5. Configuration & Environment Variables

Create `.env` in `ai-service/`:

```dotenv
PORT=8000

# Choose provider: 'mock' (default offline) or 'openrouter'
AI_PROVIDER=openrouter

# OpenRouter free model name:
AI_MODEL=meta-llama/llama-3.3-70b-instruct:free

# OpenRouter API Key (free from https://openrouter.ai/keys)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx

AI_REQUEST_TIMEOUT_SECONDS=15
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=CaseMind
```

---

## 6. Testing & Evaluation

### Running Tests
The entire test suite runs offline using the deterministic mock provider:
```bash
cd ai-service
pytest -v
```

### Test Coverage Summary
- **Classification Tests (`test_classify.py`):**
  - Valid in-scope, off-topic, and uncertain detection.
  - Empty, blank, and malformed request validation (HTTP 400).
  - Accuracy evaluation against 50 dataset fixtures (> 85% accuracy).
- **Case Matching Tests (`test_match_case.py`):**
  - Empty candidate handling.
  - Candidate ID constraint validation (no hallucinated IDs permitted).
  - Ambiguous candidate confirmation flagging.
  - Hard negative rejection.
  - Accuracy evaluation against 40 dataset fixtures (> 80% accuracy).
- **Outcome Extraction Tests (`test_extract_outcome.py`):**
  - Verification of `failed`, `succeeded`, `unknown`, and `not_provided`.
  - Non-success rule: Attempting a step without confirmation is not treated as success.
  - Accuracy evaluation against 20 dataset fixtures (> 85% accuracy).
- **Resilience Tests (`test_resilience.py`):**
  - Provider timeout handling (returns HTTP 503 `AI_UNAVAILABLE`).
  - OpenRouter malformed output retry repair.
  - Sanitization of out-of-range confidence values and invalid enums.
  - Guarantee that mock mode runs with no API keys.

---

## 7. Integration Guide for the Backend (Node.js)

Your friend building the backend can consume the AI service via HTTP calls:

```javascript
// Example helper in Node.js backend:
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

async function classifyCustomerMessage(message) {
  try {
    const res = await fetch(`${AI_SERVICE_URL}/internal/v1/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        allowedIssueTypes: ['internet_connectivity']
      })
    });
    if (!res.ok) {
      const errData = await res.json();
      console.warn('AI classify returned error:', errData);
      return { category: 'uncertain', confidence: 0.0 };
    }
    return await res.json();
  } catch (err) {
    console.error('AI service unreachable:', err);
    // Safe deterministic fallback as per Shared Contract
    return { category: 'uncertain', confidence: 0.0 };
  }
}
```

---

## 8. Docker & Orchestration

The service can be built and run independently or via the provided [`docker-compose.yml`](docker-compose.yml):

```bash
# Build and run AI service standalone
cd ai-service
docker build -t casemind-ai-service .
docker run -p 8000:8000 --env-file .env casemind-ai-service

# Or run with Docker Compose from project root
docker compose up -d ai-service postgres
```
