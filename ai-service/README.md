# AI Service — Case Continuity Engine

**Stack:** Python 3.12 + FastAPI + Pydantic v2 + httpx  
**Port:** `8001` (Internal HTTP only)  
**Contract Authority:** [`Docs/00_SHARED_CONTRACT.md`](../Docs/00_SHARED_CONTRACT.md)

---

## 1. Overview & Architectural Boundaries

The AI Service is an internal microservice providing Natural Language Processing (NLP) assistance to the Node.js backend. It operates under strict ownership boundaries:

- **No Database:** This service does **not** connect to PostgreSQL or any database.
- **No Direct Browser Access:** Only the Node.js backend calls this service at `http://ai-service:8000`.
- **No Case/Playbook Decisions:** Node.js retains authority for case state, playbook progression, contact count, and escalation. The AI service only suggests interpretations of free-form customer text.

---

## 2. API Endpoints

All endpoints are prefixed with `/internal/v1`.

### 1. `POST /internal/v1/classify`
Determines whether an incoming customer message is an internet connectivity issue, off-topic, or uncertain.

- **Request:**
  ```json
  {
    "message": "My Wi-Fi keeps disconnecting every 10 minutes",
    "allowedIssueTypes": ["internet_connectivity"]
  }
  ```
- **Response:**
  ```json
  {
    "category": "internet_connectivity",
    "confidence": 0.95,
    "reason": "The message describes an internet connectivity problem."
  }
  ```
- **Categories:** `internet_connectivity`, `off_topic`, `uncertain`.

---

### 2. `POST /internal/v1/match-case`
Suggests which existing unresolved case (if any) the message refers to.

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
- **Response:**
  ```json
  {
    "matchedCaseId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "confidence": 0.91,
    "needsConfirmation": false,
    "reason": "Strong match based on message similarity to the case description."
  }
  ```

---

### 3. `POST /internal/v1/extract-outcome`
Extracts whether the customer reported a troubleshooting step outcome.

- **Request:**
  ```json
  {
    "message": "I turned it off and on, but the internet is still down",
    "currentStepKey": "router_power_cycle"
  }
  ```
- **Response:**
  ```json
  {
    "outcome": "failed",
    "confidence": 0.94,
    "evidence": "Customer indicates the step did not resolve the issue: 'still down' detected."
  }
  ```
- **Outcomes:** `failed`, `succeeded`, `unknown`, `not_provided`.

---

### 4. `GET /health`
Health check endpoint returning `{"status": "ok"}`.

---

## 3. Configuration & Providers

The service supports two provider modes configured via `.env`:

### Mode A: Deterministic Mock Provider (Default)
Used for automated testing and offline demos. Requires no internet connection and no API keys.

```dotenv
PORT=8000
AI_PROVIDER=mock
```

### Mode B: OpenRouter Free AI Models
Connects to OpenRouter's free AI models using OpenRouter's OpenAI-compatible completions API.

```dotenv
PORT=8000
AI_PROVIDER=openrouter

# Popular free models on OpenRouter:
# - meta-llama/llama-3.3-70b-instruct:free
# - google/gemini-2.0-flash-exp:free
# - mistralai/mistral-7b-instruct:free
# - deepseek/deepseek-r1:free
AI_MODEL=meta-llama/llama-3.3-70b-instruct:free

# Get your free key at https://openrouter.ai/keys
OPENROUTER_API_KEY=your_openrouter_api_key_here

AI_REQUEST_TIMEOUT_SECONDS=15
```

---

## 4. Running Locally

### Prerequisites
- Python 3.11+
- pip

### Setup
```bash
cd ai-service

# Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env
```

### Start the Service
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```
Interactive API documentation will be available at `http://localhost:8001/docs`.

---

## 5. Running Tests

The test suite runs completely offline with no network or API keys:

```bash
pytest -v
```

### What is tested:
1. `test_classify.py`: Valid in-scope, off-topic, uncertain classifications, input validation, and 50 evaluation fixtures.
2. `test_match_case.py`: Empty candidates, candidate containment, ambiguous candidates, hard negatives, and 40 evaluation fixtures.
3. `test_extract_outcome.py`: Succeeded, failed, unknown, not_provided outcomes, non-success rule enforcement, and 20 evaluation fixtures.
4. `test_resilience.py`: 503 on provider timeout, OpenRouter malformed JSON retry repair, value sanitation, and zero-key guarantees.


---

## 6. Docker Container
Docker containerization will be handled via a unified root Docker configuration once backend, AI service, and frontend are ready.
