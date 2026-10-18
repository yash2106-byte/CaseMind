# Backend PRD — Case Continuity Engine

**Stack:** Node.js + Express.js + PostgreSQL  
**Owner:** Backend developer  
**Authoritative contract:** [`00_SHARED_CONTRACT.md`](00_SHARED_CONTRACT.md)

---

## 1. Objective

Build the public REST API and the authoritative case-management engine. The backend is responsible for storing state, validating requests, enforcing the action ledger, selecting playbook steps, incrementing contact counts, and escalating cases. The AI service may return a classification or matching suggestion, but the backend must independently validate it and apply business rules.

The backend must be independently testable while the Python AI service is offline.

## 2. Deliverables

1. Express application with all `/api/v1` routes in the Shared Contract.
2. PostgreSQL migrations for customers, cases, sessions, events, action ledger, and playbook steps.
3. Seed and reset scripts for three demo customers and six playbook steps.
4. AI-service HTTP client with timeout, validation, and safe failure behavior.
5. Case lifecycle, action outcome, escalation, and handoff-summary services.
6. Dashboard metrics query/service.
7. Request validation and canonical error middleware.
8. Unit tests, API tests, and database-backed integration tests.
9. `.env.example`, Dockerfile, Compose compatibility, API documentation, and README.

---

## 3. Suggested source layout

```text
backend/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── routes/
│   │   ├── health.routes.js
│   │   ├── customers.routes.js
│   │   ├── sessions.routes.js
│   │   ├── cases.routes.js
│   │   └── dashboard.routes.js
│   ├── controllers/
│   ├── services/
│   │   ├── session.service.js
│   │   ├── message.service.js
│   │   ├── case.service.js
│   │   ├── playbook.service.js
│   │   ├── outcome.service.js
│   │   ├── escalation.service.js
│   │   ├── handoff-summary.service.js
│   │   └── metrics.service.js
│   ├── clients/ai.client.js
│   ├── repositories/
│   ├── db/
│   ├── schemas/
│   └── middleware/
├── migrations/
├── seeds/
├── tests/
├── package.json
├── Dockerfile
└── .env.example
```

This is a recommended structure, not a requirement to use every file exactly. Keep HTTP handling, business logic, and database access separated so they can be tested independently.

## 4. Dependencies and configuration

Use one package manager and one test runner consistently. Recommended:
- Express for HTTP.
- `pg` or one selected ORM for PostgreSQL.
- Zod (or equivalent) for request/response validation.
- Vitest + Supertest for tests.
- A UUID library only if the runtime/database does not already generate UUIDs.

Example environment variables:
```dotenv
PORT=3000
DATABASE_URL=postgres://app:app_password@postgres:5432/case_continuity
AI_SERVICE_URL=http://ai-service:8000
AI_REQUEST_TIMEOUT_MS=5000
CASE_MATCH_AUTO_THRESHOLD=0.80
CASE_MATCH_CONFIRM_THRESHOLD=0.55
NODE_ENV=development
```
Do not commit real secrets. `.env.example` must contain placeholders only. The database URL above is an example for local Compose, not a production credential.

## 5. Required API behavior

Implement the routes and exact JSON schemas in the Shared Contract:
- `GET /api/v1/health`
- `GET /api/v1/customers`
- `GET /api/v1/cases`
- `GET /api/v1/cases/:caseId`
- `GET /api/v1/cases/:caseId/timeline`
- `GET /api/v1/cases/:caseId/handoff-summary`
- `POST /api/v1/sessions`
- `POST /api/v1/sessions/:sessionId/messages`
- `POST /api/v1/cases/:caseId/actions/:actionId/outcome`
- `GET /api/v1/dashboard/metrics`

Do not add an alternate route for the same operation unless the Shared Contract is updated first.

### 5.1 `POST /sessions`

Algorithm:
1. Validate `customerId` as UUID and confirm the customer exists.
2. Begin a transaction and insert a new `chat_sessions` row.
3. Find the customer's most recently updated case whose status is `open` or `in_progress`.
4. If found, lock the case row, attach the new session, increment `contact_count` once, update `last_contact_at`, and append `contact_started`.
5. If the new count is `>= 3`, call the idempotent escalation service inside the transaction. Do not create a new action.
6. If no unresolved case exists, leave `case_id` null. The first message will decide whether to create a case.
7. Commit and return the session response defined in the contract.

**Important:** Do not count a message as a contact. A single session with 20 messages still counts as one contact. Do not count the first message of a newly created case twice: a new case starts at `contact_count=1`.

### 5.2 `POST /sessions/:sessionId/messages`

Algorithm:
1. Validate session UUID and non-empty message (trim whitespace; recommended max length 2,000 characters).
2. Load the session and its customer. Reject unknown session with 404.
3. Append/record the inbound message in the appropriate event history. If the session has a case, attach the event to that case.
4. If the session has no case:
   - Call AI `classify`.
   - If `off_topic`, return the exact fixed scope response and do not create a case.
   - If `uncertain`, return a clarification response and do not create a case.
   - If `internet_connectivity`, create a case with `contact_count=1`, attach the session, write `case_created` and `contact_started` events, then choose the first eligible step.
5. If the session already has a case:
   - If status is `escalated`, return the existing handoff summary and do not continue troubleshooting.
   - If status is `resolved` or `closed`, do not silently reopen it. Ask whether the customer has a new issue; a confirmed new issue should use a new session and new case.
   - If status is `open` or `in_progress`, use AI matching only as a suggestion when needed. Do not create a duplicate case for a clear recurrence.
6. If an action is in `recommended`, `attempted`, or `unknown` state, do not issue a second action. Ask the customer to report or clarify the outcome.
7. Return `case`, `reply`, `recommendedAction`, and `needsOutcome` exactly as defined by the contract.

### 5.3 Action selection service

Implement one function as the only place allowed to choose the next action, e.g. `selectNextEligibleAction(caseId)`.

It must:
1. Lock the case row in a transaction.
2. Confirm case status is `open` or `in_progress`.
3. Check whether an action is currently awaiting an outcome. If yes, return that state rather than creating another action.
4. Read the six playbook steps in ascending `step_order`.
5. Exclude all steps whose status for this case is `failed` or `succeeded`.
6. If no step remains and the case is unresolved, escalate.
7. Otherwise insert a new `action_ledger` row with status `recommended`, update `current_step_key`, set case status `in_progress`, append `action_recommended`, and commit.
8. Return the persisted action record. Never generate an action only in memory and send it without persisting it first.

### 5.4 `POST /cases/:caseId/actions/:actionId/outcome`

Algorithm:
1. Validate case ID, action ID, and `outcome` (`failed`, `succeeded`, `unknown`).
2. Start transaction and lock case/action rows.
3. Verify action belongs to case and case is not escalated/resolved/closed.
4. If action already has the same terminal outcome, return current state without duplicating events. If it has a different terminal outcome, return 409.
5. Persist the requested outcome and `outcome_at`; save optional note; append `action_outcome_recorded`.
6. For `succeeded`, set case `resolved`, set `resolved_at`, clear `current_step_key`, append `case_resolved`, and return no recommended action.
7. For `failed`, permanently exclude that step key for this case. Select the next eligible step. If no step remains, escalate.
8. For `unknown`, retain the unresolved current action and ask for clarification. Do not automatically move to the next step. A later clarification may update `unknown` to `failed` or `succeeded`; once an action is `failed` or `succeeded`, reject a conflicting outcome.
9. Commit the entire transition atomically and return canonical case state.

## 6. Escalation service

Implement one idempotent function, e.g. `escalateCase(caseId, reason)` where reason is:
- `contact_limit_reached`
- `playbook_exhausted`

Rules:
- If already escalated, return existing summary without adding a second escalation event.
- If resolved or closed, do not escalate.
- Set case status to `escalated`.
- Generate summary from persisted case facts; do not ask the LLM to decide which facts matter.
- Save summary in `handoff_summary`.
- Append one `case_escalated` event with reason in metadata.
- Clear `current_step_key` so the frontend does not display a live action.
- Return the updated case and summary.

The summary must list failed actions by label and preserve the timeline in chronological order. It should state that mocked actions were simulated if they appear in the history.

## 7. AI client and safe behavior

The AI client calls only:
- `POST /internal/v1/classify`
- `POST /internal/v1/match-case`
- `POST /internal/v1/extract-outcome`

Use a short timeout (default 5 seconds), validate response schemas, and log request IDs—not raw secrets. The backend must reject a `matchedCaseId` that was not present in the candidates supplied to AI.

If AI is unavailable:
- Read-only case APIs still work.
- Existing action outcomes submitted by explicit UI buttons still work.
- For an obviously in-scope first message, a conservative keyword fallback may classify it as internet-related; ambiguous messages must trigger clarification.
- Never invent a semantic case match or claim an outcome was successful.
- Return `AI_UNAVAILABLE` only when a safe fallback is not possible.

## 8. Database and concurrency

Use migrations, not ad hoc schema creation on startup. The schema must follow Section 8 of the Shared Contract.

Atomic operations:
- New session + contact increment + event.
- Outcome update + event + next action or escalation.
- Escalation status + summary + event.
- Case creation + first session attachment + initial events + first action recommendation.

Use transactions and `SELECT ... FOR UPDATE` or equivalent locking for concurrent updates. Add a test that simulates two requests trying to record outcomes or select the next step at the same time. Only one outstanding action may exist.

## 9. Metrics implementation

Calculate dashboard values from persisted records, not frontend state.

- `totalCases`: all cases.
- `openCases`: status `open` or `in_progress` (document this interpretation in the API code and UI).
- `escalatedCases`: status `escalated`.
- `resolvedCases`: status `resolved`.
- `repeatContactRate`: cases with `contact_count >= 2` divided by cases with at least one contact.
- `repeatedRecommendationRate`: recommendations whose `step_key` had a prior `failed` action for the same case divided by all recommendations. This should remain zero in valid operation.

If the denominator is zero, return `0.0`. Rates are decimals, not percentage integers.

## 10. Independent testing plan

### Test setup
- Use Vitest + Supertest.
- Import the Express `app` without starting `server.js`.
- Mock the AI client for unit and route tests.
- Use a dedicated test PostgreSQL database for repository/transaction tests.
- Provide deterministic fixtures for all six playbook steps and three customers.
- `npm test` must not require Python, API keys, or internet access.

### Required unit tests
- Contact-count policy: first case = 1; new session increments once; messages do not increment.
- Action selector excludes failed and succeeded step keys.
- Escalation is idempotent.
- Handoff summary lists failed steps and reason.
- Metrics return 0.0 when denominators are zero.
- AI response validator rejects unknown enums and invented case IDs.

### Required API tests
1. Invalid customer UUID returns 400 with canonical error envelope.
2. Unknown customer/session/case/action returns 404.
3. Off-topic first message creates no case.
4. In-scope first message creates one case and recommends `router_power_cycle`.
5. Repeated messages in same session do not increase `contactCount`.
6. Failed `router_power_cycle` causes `check_cables_lights` to be recommended next.
7. The same failed step is never recommended again, even after starting a new session.
8. Succeeded outcome resolves case and returns no action.
9. Unknown outcome does not advance playbook.
10. Third session escalates before recommending an action.
11. Playbook exhaustion escalates.
12. Duplicate same outcome is idempotent; an `unknown` outcome may later be clarified to `failed` or `succeeded`.
13. Conflicting terminal outcome returns 409.
14. AI timeout follows safe fallback/clarification behavior.
15. Invalid body and unsupported outcome return 400.

### Database-backed tests
- Migrations apply cleanly to an empty database.
- Foreign-key constraints reject orphan actions/events.
- Transactions roll back partial outcome transitions.
- Two concurrent requests cannot create two active recommended actions.
- Repeating a session-creation request according to the chosen idempotency design cannot double-increment the contact count.

## 11. Definition of done

- Every public route matches the Shared Contract.
- All business rules are implemented in services, not route handlers or AI prompts.
- Independent tests pass with AI stopped.
- Database tests pass against a dedicated test database.
- Seed/reset commands reproduce the demo.
- README documents setup, environment variables, test commands, and a full demo flow.
