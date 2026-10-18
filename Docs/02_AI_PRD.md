# AI Service PRD — Case Continuity Engine

**Stack:** Python + FastAPI + Pydantic  
**Owner:** AI engineer  
**Authoritative contract:** [`00_SHARED_CONTRACT.md`](00_SHARED_CONTRACT.md)

---

## 1. Objective

Build a Python service that helps interpret free-form customer language. It performs three narrowly scoped tasks:

1. Classifies whether a message is about internet connectivity, off-topic, or uncertain.
2. Suggests which supplied unresolved case a message refers to.
3. Extracts whether the customer says the current troubleshooting step failed, succeeded, is unknown, or has no stated outcome.

This service does **not** own cases, the action ledger, playbook selection, or escalation. It does not connect to PostgreSQL. Node.js is the authority for every state transition.

## 2. Deliverables

- FastAPI application with three internal endpoints.
- Pydantic request and response models.
- Provider abstraction with deterministic fake provider for tests.
- Optional free-tier LLM adapter selected through environment configuration.
- Prompts and output validation.
- Pytest suite that runs offline.
- Versioned fixed evaluation dataset with positive and negative examples.
- Dockerfile, `requirements.txt`, `.env.example`, and README.

## 3. Suggested structure

```text
ai-service/
├── app/
│   ├── main.py
│   ├── schemas.py
│   ├── routes/
│   │   ├── classify.py
│   │   ├── match_case.py
│   │   └── extract_outcome.py
│   ├── providers/
│   │   ├── base.py
│   │   ├── mock_provider.py
│   │   └── free_tier_provider.py
│   └── services/
│       ├── classification_service.py
│       ├── matching_service.py
│       └── outcome_service.py
├── tests/
├── fixtures/
├── requirements.txt
├── Dockerfile
└── .env.example
```

## 4. Runtime and environment

- FastAPI listens on port `8000`.
- Backend reaches it at `http://ai-service:8000` inside Docker Compose.
- No browser calls this service.
- No database URL should be configured in this service.
- Suggested environment variables:
```dotenv
PORT=8000
AI_PROVIDER=mock
AI_MODEL=
AI_API_KEY=
AI_REQUEST_TIMEOUT_SECONDS=5
```
The mock provider is the default for automated tests. A free-tier provider can be configured for manual demo use, if available. Never commit API keys.

## 5. Endpoint specifications

Implement exactly the three endpoints in the Shared Contract.

### 5.1 `POST /internal/v1/classify`

Input:
```json
{
  "message": "My internet keeps disconnecting",
  "allowedIssueTypes": ["internet_connectivity"]
}
```

Output:
```json
{
  "category": "internet_connectivity",
  "confidence": 0.96,
  "reason": "The message explicitly describes an internet connection problem."
}
```

Rules:
- `internet_connectivity`: the message is about home/broadband/Wi-Fi connectivity or access.
- `off_topic`: the message is clearly about something else.
- `uncertain`: message is too vague to classify safely.
- Confidence must be a number from `0.0` to `1.0`.
- Do not classify a message as in scope merely because it mentions a router, internet company, or device in an unrelated context.
- Keep `reason` concise and avoid hidden chain-of-thought; it should be a short user-safe rationale.

### 5.2 `POST /internal/v1/match-case`

Input:
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

Output:
```json
{
  "matchedCaseId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "confidence": 0.91,
  "needsConfirmation": false,
  "reason": "The message refers to the same unresolved connection problem."
}
```

Rules:
- Only choose an ID present in the supplied candidate list, or return `null`.
- If candidate list is empty, return `matchedCaseId: null`, `confidence: 0.0`, `needsConfirmation: false`.
- Do not invent candidate IDs or use outside context.
- Similar wording alone is insufficient if the actual issue differs.
- If multiple cases are similarly plausible, return null and set `needsConfirmation: true`.
- Use failed step keys as context about what was tried, not as evidence that the case is resolved.
- AI must not recommend the next playbook step.

### 5.3 `POST /internal/v1/extract-outcome`

Input:
```json
{
  "message": "I tried it but the internet is still down",
  "currentStepKey": "router_power_cycle"
}
```

Output:
```json
{
  "outcome": "failed",
  "confidence": 0.94,
  "evidence": "The user says the internet is still down after trying the step."
}
```

Allowed outcomes:
- `failed`: user says the step was tried and did not fix the issue.
- `succeeded`: user explicitly says the internet issue is fixed.
- `unknown`: user tried the step but result is unclear, contradictory, or not yet verified.
- `not_provided`: the message does not report an outcome for the current step.

Important:
- “I turned it off and on” is not automatically success.
- “I did it” is usually `unknown` or `not_provided`, depending on context.
- “It works now; I can browse again” can be `succeeded`.
- “Still no connection after restarting it” is `failed`.
- The explicit UI outcome buttons are the primary source of outcomes. AI extraction is assistive only; Node must validate confidence and state. An `unknown` result must not unlock a new action; it can later be clarified to `failed` or `succeeded`.

## 6. Matching thresholds and response validation

Use the threshold policy in the Shared Contract:
- `confidence >= 0.80`: strong suggestion; Node may auto-match only if exactly one candidate is eligible.
- `0.55 <= confidence < 0.80`: ask the user to confirm.
- `confidence < 0.55`: return no confident match.

The backend remains authoritative and applies the thresholds. The AI service should still set `needsConfirmation` appropriately, but Node must not trust that boolean without checking confidence and candidate membership.

For every endpoint:
1. Validate request fields using Pydantic.
2. Call the selected provider.
3. Parse structured JSON.
4. Validate enums, confidence range, required strings, and candidate IDs.
5. If model output is malformed, retry once with a repair instruction if supported.
6. If still invalid, return a typed 503 error rather than fabricate a result.

Use short timeouts and limited token budgets. Never ask the model to write SQL or access external systems.

## 7. Free-tier provider policy

The team has no API budget. Therefore:
- Default unit and CI tests must use the fake provider.
- Manual demo may use an available free tier, subject to its current limits and availability.
- Provider configuration must be replaceable without changing endpoint schemas.
- The application must not depend on a particular model's proprietary response format.
- Do not build essential product correctness around live LLM memory. The case ledger and playbook remain deterministic in Node/PostgreSQL.
- Do not send secrets or unnecessary customer data to the provider. Demo customers are synthetic.

## 8. Fixed evaluation dataset

Create a JSONL or JSON fixture dataset with at least:
- 20 in-scope classification examples.
- 20 off-topic examples.
- 10 uncertain/ambiguous examples.
- 20 case-matching paraphrases.
- 20 hard-negative case-matching examples.
- 20 outcome-extraction examples spread across all four outcomes.

Example classification cases:
- In-scope: “My Wi-Fi is connected but no sites load.”
- In-scope: “Broadband stopped working after the storm.”
- In-scope: “The internet keeps disconnecting every few minutes.”
- Off-topic: “Can you help me change my bank PIN?”
- Off-topic: “My phone screen is cracked.”
- Uncertain: “It stopped working again.” (without prior case context)

Example match cases:
- Positive: “Same internet issue as yesterday.”
- Positive: “Still no connection after I restarted it.”
- Hard negative: “My mobile data is slow, but home Wi-Fi works.”
- Hard negative: “The router's delivery is late.” (not a connectivity issue)

Example outcome cases:
- Failed: “I tried it; still no internet.”
- Succeeded: “It works now and I can open websites.”
- Unknown: “The lights are different, but I haven't tested it.”
- Not provided: “Can you explain why this step helps?”

Keep development examples and held-out evaluation examples separate. Do not tune prompts using the held-out examples and then report the same set as an unbiased evaluation.

## 9. Independent testing plan

Use `pytest` and FastAPI `TestClient`. The default command must work with:
- no Node.js backend running;
- no PostgreSQL;
- no API key;
- no internet access.

Required tests:
1. Valid in-scope classification.
2. Valid off-topic classification.
3. Uncertain classification.
4. Empty or malformed message validation.
5. Case match returns only a supplied candidate ID.
6. Empty candidates return null.
7. Similar paraphrase matches correct case.
8. Ambiguous candidates require confirmation.
9. Hard-negative message does not match an unrelated case.
10. All outcome values are handled.
11. Explicit success is required for `succeeded`.
12. Attempting a step is not automatically success.
13. Invalid enum/confidence response is rejected.
14. Provider timeout returns 503.
15. Malformed model output retries once and then fails safely.
16. No API key is read by tests when mock provider is selected.

Optional live-provider smoke tests must be separately named and skipped unless credentials are explicitly configured. They must never be part of the default `pytest` run.

## 10. Definition of done

- Three endpoints exactly match the Shared Contract.
- All outputs are schema-valid.
- The service has no database dependency.
- Tests pass offline with the fake provider.
- Evaluation fixtures and a short results summary are committed.
- `.env.example` contains no secrets.
- README explains how to run the service, run tests, and optionally configure a free-tier provider.
