# Backend PRD --- Case Continuity Engine

**Version:** 1.0\
**Status:** Implementation-ready working PRD\
**Owner:** Backend team\
**Stack:** Node.js + Express.js + PostgreSQL (`pg` / pgvector-capable
image)\
**Authoritative contract:** `00_SHARED_CONTRACT.md`\
**Related PRDs:** `02_AI_PRD.md`, `03_FRONTEND_PRD.md`

> **Source-of-truth rule:** This PRD explains how the backend should be
> implemented. It does not replace the Shared Contract. If a route,
> field, enum, state transition, or response differs,
> `00_SHARED_CONTRACT.md` wins. Update the Shared Contract first before
> changing this PRD or another team's implementation.

------------------------------------------------------------------------

## 0. How to use this PRD

This document is divided into small, ordered implementation steps.
Complete each step and its acceptance checks before moving to the next
one. Each step identifies the goal, implementation work, dependencies,
and tests.

Recommended workflow:

1.  Read the Shared Contract sections referenced by the step.
2.  Implement only the step's scope.
3.  Run that step's tests.
4.  Commit the working change.
5.  Confirm any cross-team interface changes before proceeding.
6.  Keep the backend independent from the live Python AI service during
    normal development.

### Non-negotiable integration rules

-   Public HTTP routes and JSON shapes must match the Shared Contract
    exactly.
-   The browser communicates only with the Node.js backend; it must
    never call the AI service.
-   The Python AI service never connects to PostgreSQL and never owns
    persistent case state.
-   Node.js owns case creation, case matching decisions, action
    selection, action outcomes, contact counts, and escalation.
-   AI outputs are untrusted suggestions. Validate their schemas,
    confidence, enum values, and candidate IDs before using them.
-   A failed step must never be recommended again for the same case.
-   Only one action may be awaiting an outcome for a case at a time.
-   A contact is a new chat session, not a message.
-   A third contact escalates an unresolved case before another
    troubleshooting action is returned.
-   An `unknown` action outcome does not advance the playbook.
-   All timestamps returned by the API are ISO 8601 UTC strings; all IDs
    are UUID strings; API fields use `camelCase`.
-   Independent tests must run without the other services, external
    network, or paid API credentials.

## 1. Objective

Build the authoritative Node.js REST API and case-management engine for
the Case Continuity Engine demo. The backend stores persistent
internet-connectivity cases, links sessions to unresolved cases, records
action history, prevents repeated failed steps, resolves cases when
success is explicitly confirmed, and escalates unresolved cases
deterministically.

The backend must support the React frontend and the Python AI service
described by their respective PRDs.

### 1.1 Phase 1 product boundaries

**In scope** - Three seeded demo customers; no authentication. -
Internet-connectivity issues only; English-only demo. - Customer and
case listing/details. - Session creation and message submission. - Case
continuity and AI-assisted matching against supplied candidates. - Six
fixed playbook steps. - Explicit action-outcome submission and optional
AI-assisted outcome extraction. - Append-only case timeline. -
Deterministic escalation and automatically assembled handoff summary. -
Dashboard metrics. - Docker Compose compatibility, migrations,
seed/reset scripts, tests, logging, and documentation.

**Out of scope** - Authentication or user accounts. - Real ISP
integration, real outage lookup, real router/line reset, or real
technician booking. - Live human-agent console or actual notification to
a human agent. - WebSockets/SSE; frontend polling is used. -
Multilingual support. - Production deployment requirements. - Treating
vector similarity or LLM memory as the authority for a case decision.

### 1.2 Backend success criteria

The backend is complete when: 1. Every public route and response matches
the Shared Contract. 2. All case-state transitions are enforced by
backend services and database transactions. 3. Failed steps cannot be
recommended again for the same case. 4. At most one `recommended`,
`attempted`, or `unknown` action exists for a case at any time. 5.
Session creation increments contact count exactly once for an existing
unresolved case. 6. A newly created case starts at `contactCount = 1`.
7. Third-contact and playbook-exhaustion escalation work and are
idempotent. 8. AI outages do not break read-only APIs or explicit UI
outcome submission. 9. Unit, API, database, and integration tests pass.
10. The frontend can run against the API without undocumented routes or
fields.

## 2. Architecture and ownership

### 2.1 Runtime architecture

-   Frontend: React + TypeScript + Vite, normally at host port `5173`.
-   Backend: Node.js + Express, host port `3000`.
-   AI service: Python + FastAPI, host port `8000`.
-   Database: PostgreSQL using an image with pgvector support, internal
    port `5432`.
-   Orchestration: Docker Compose.
-   Backend-to-AI URL inside Compose: `http://ai-service:8000`.
-   Frontend base URL example:
    `VITE_API_BASE_URL=http://localhost:3000/api/v1`.

The exact route prefixes must follow the Shared Contract and the
existing frontend API client. Do not introduce a second alias for the
same route. In this PRD, route names shown without the common `/api/v1`
prefix are relative to that prefix; the externally visible paths are
those listed in the Shared Contract.

### 2.2 Ownership matrix

  -----------------------------------------------------------------------
  Responsibility          Owner                   Backend rule
  ----------------------- ----------------------- -----------------------
  Persist customers,      Backend + PostgreSQL    The only source of
  sessions, cases,                                canonical persisted
  actions, and events                             state

  Classify free-form      AI service              Backend validates
  language                                        result and handles
                                                  fallback

  Suggest a semantic case AI service              Backend supplies
  match                                           candidates and
                                                  validates returned ID

  Decide whether to       Backend                 Never delegate final
  create/reuse a case                             decision to the model

  Select the next         Backend                 Fixed order and
  playbook step                                   eligibility rules

  Interpret action        UI button first; AI     Backend validates and
  outcome                 extraction assistive    persists the final
                                                  outcome

  Increment contact count Backend                 Only for new sessions
                                                  associated with an
                                                  existing unresolved
                                                  case

  Decide escalation       Backend                 Deterministic rules; no
                                                  LLM discretion

  Assemble handoff        Backend                 Use persisted facts and
  summary                                         timeline

  Display canonical state Frontend using API      Frontend must not
                          responses               invent case state

  Simulate external ISP   Backend mock handlers   Never imply real
  actions                                         external operations
                                                  occurred
  -----------------------------------------------------------------------

### 2.3 Proposed source layout

Use this structure as a guide; folder names may change if boundaries
remain clear.

``` text
backend/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   └── env.js
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
│   │   ├── matching.service.js
│   │   ├── playbook.service.js
│   │   ├── outcome.service.js
│   │   ├── escalation.service.js
│   │   ├── handoff-summary.service.js
│   │   └── metrics.service.js
│   ├── clients/
│   │   └── ai.client.js
│   ├── repositories/
│   ├── db/
│   ├── schemas/
│   ├── middleware/
│   └── lib/
├── migrations/
├── seeds/
├── tests/
├── Dockerfile
├── package.json
└── .env.example
```

Keep route handlers thin. Routes validate and call services; services
own business rules; repositories own SQL; the AI client owns internal
HTTP communication.

## 3. Technical choices and configuration

### 3.1 Required choices

-   Runtime: Node.js 20 or 22 LTS; pin one version consistently in
    `package.json`, Dockerfile, and team instructions.
-   HTTP: Express.js.
-   Database: PostgreSQL through `pg` or one explicitly selected ORM.
-   Schema management: versioned migrations are authoritative; do not
    silently create or mutate schema on application startup.
-   Validation: Zod or an equivalent schema validator.
-   Tests: Vitest or Jest; Vitest + Supertest is recommended.
-   Logs: structured JSON logs with request ID, route, duration, session
    ID, and case ID when available.
-   IDs: UUIDs.
-   API timestamps: ISO 8601 UTC strings.
-   API JSON keys: `camelCase`; SQL columns: `snake_case`.

### 3.2 Environment variables

Create `.env.example` with placeholders only. Do not commit secrets.

``` dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://app:replace_me@postgres:5432/case_continuity
AI_SERVICE_URL=http://ai-service:8000
AI_REQUEST_TIMEOUT_MS=5000
CASE_MATCH_AUTO_THRESHOLD=0.80
CASE_MATCH_CONFIRM_THRESHOLD=0.55
CORS_ORIGIN=http://localhost:5173
```

Use the exact names expected by the Shared Contract and Compose
configuration. Do not create competing aliases for the AI timeout or
matching thresholds. Validate environment values at startup and fail
with a clear error if required configuration is invalid.

### 3.3 Error envelope

All errors must use the Shared Contract shape:

``` json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A concise, safe explanation.",
    "requestId": "req-example"
  }
}
```

Supported codes and HTTP statuses: - `400 VALIDATION_ERROR`: invalid
request, UUID, enum, or body. - `404 NOT_FOUND`: customer, session,
case, or action does not exist. - `409 CONFLICT`: invalid transition or
conflicting duplicate terminal outcome. - `503 AI_UNAVAILABLE`: AI
unavailable and no safe deterministic fallback applies. -
`500 INTERNAL_ERROR`: unexpected server error.

Never return stack traces, provider payloads, API keys, database
credentials, or internal prompts to the browser.

## 4. Ordered implementation roadmap

The following steps are the recommended build order. A step is not
complete until its acceptance checks pass.

### Step 0 --- Contract and repository alignment

**Goal:** Ensure all three teams are implementing the same interface.

**Read first:** Shared Contract Sections 1--7 and 9--11; README delivery
sequence.

**Tasks** 1. Review the Shared Contract with frontend and AI developers.
2. Confirm all public routes, request/response schemas, enum values,
status transitions, and error responses. 3. Confirm the three AI
endpoints and their exact schemas: - `POST /internal/v1/classify` -
`POST /internal/v1/match-case` - `POST /internal/v1/extract-outcome` 4.
Confirm that the browser calls only the backend. 5. Confirm the six
stable playbook keys and exact order. 6. Confirm third-contact
escalation, unknown-outcome handling, and summary-generation ownership.
7. Create a contract-derived API type/schema reference. If OpenAPI is
added, it must match the Shared Contract rather than introduce a new
contract. 8. Record any proposed contract changes before implementing
them.

**Acceptance checks** - \[ \] Backend, AI, and frontend owners agree on
the contract version. - \[ \] No team plans alternate route names or
different enum values. - \[ \] Shared request/response fixtures are
available for tests. - \[ \] Any discrepancy is resolved in the Shared
Contract first.

**Deliverable:** A short contract sign-off in the repository or team
notes.

### Step 1 --- Bootstrap Express and runtime configuration

**Goal:** Start a stable backend application with consistent errors and
health checks.

**Dependencies:** Step 0.

**Tasks** 1. Initialize the Node.js package and pin the supported
runtime. 2. Create `app.js` to configure Express middleware and routes
without listening on a port. 3. Create `server.js` to load
configuration, connect to PostgreSQL, and start listening. 4. Add JSON
body parsing and request ID generation/propagation. 5. Add central error
middleware that emits the canonical error envelope. 6. Add unknown-route
handling with `NOT_FOUND`. 7. Add CORS for the configured frontend
origin, allowing only required methods and headers. 8. Implement
`GET /api/v1/health` as defined by the Shared Contract. 9. Keep
application importable by tests without starting the server. 10. Add
structured request logging; never log secrets or unnecessary raw
customer messages.

**Tests** - Health endpoint returns the contract response. - Invalid
JSON and malformed inputs produce safe error responses. - Unknown route
returns the canonical 404 envelope. - Unexpected errors do not expose
stack traces. - `app.js` can be imported without opening a listening
port.

**Acceptance checks** - \[ \] `npm test` runs without starting a
server. - \[ \] Health endpoint is reachable. - \[ \] Request IDs are
included in errors. - \[ \] CORS and environment parsing behave as
documented.

**Deliverable:** Running Express skeleton and README run instructions.

### Step 2 --- Database migrations, constraints, and seed data

**Goal:** Create the authoritative persistent data model.

**Dependencies:** Step 0; Step 1 may be developed in parallel.

**Tasks** 1. Create versioned migrations for: - `customers` - `cases` -
`chat_sessions` - `case_events` - `action_ledger` - `playbook_steps` 2.
Match all fields, nullability, defaults, foreign keys, and enum/check
constraints in Shared Contract Section 8. 3. Add indexes for
customer/status case lookup, timeline order, and ledger lookup. 4.
Enforce one outstanding action per case across statuses `recommended`,
`attempted`, and `unknown`, using a suitable partial unique index and/or
locked transaction logic. 5. Preserve historical action rows; do not
overwrite an old row to represent a new step. 6. Seed exactly three
synthetic demo customers. 7. Seed exactly the six playbook steps from
the Shared Contract in their fixed order. 8. Create repeatable seed and
development reset scripts. 9. Ensure reset commands cannot run
accidentally in production. 10. Use a pgvector-capable PostgreSQL image.
Do not make core case continuity depend on vector embeddings.

**Important schema rules** - `case.contact_count` starts at 1 and cannot
be less than 1. - A session may initially have `case_id = NULL`. - Case
events are append-only. - Action outcomes persisted from a customer are
`failed`, `succeeded`, or `unknown`; `not_provided` is AI-only. -
`unknown` may transition to `failed` or `succeeded`; terminal `failed`
and `succeeded` outcomes cannot be changed to a conflicting outcome. -
Keep API `camelCase` and database `snake_case` mappings explicit.

**Tests** - Migrations apply to an empty database. - Foreign keys reject
orphan records. - Check constraints reject invalid states and step
orders. - Seed data contains three customers and six correctly ordered
steps. - Active-action constraint prevents two outstanding actions for
the same case. - Reset is gated to development/test environments.

**Acceptance checks** - \[ \] A clean test database can be migrated from
scratch. - \[ \] Seed and reset commands are deterministic and
documented. - \[ \] Schema matches the Shared Contract exactly.

**Deliverable:** Migrations, seed/reset scripts, and database tests.

### Step 3 --- Repository layer and transaction utilities

**Goal:** Centralize database operations before implementing lifecycle
logic.

**Dependencies:** Step 2.

**Tasks** 1. Create a connection pool and a transaction helper with
guaranteed rollback on error. 2. Create repositories for customers,
sessions, cases, actions, playbook steps, and case events. 3.
Parameterize every SQL query; never interpolate user input into SQL. 4.
Add repository methods for: - Find customer by ID and list seeded
customers. - Find the most recently updated unresolved case for a
customer. - Load a case with its actions and ordered events. - Load
eligible case-matching candidates for one customer. - Read the case's
action ledger and determine active actions. - Insert/update an action
and append an event. - List cases using contract filters. - Calculate
dashboard metrics from persisted records. 5. Use `SELECT ... FOR UPDATE`
while incrementing contact count or selecting/transitioning actions. 6.
Keep SQL and row-to-API mapping out of route handlers. 7. Ensure every
multi-write business operation accepts a transaction client so all
changes commit or roll back together.

**Tests** - Repository mapping handles nullable fields and timestamps. -
Queries are scoped to the selected customer. - Timeline queries return
oldest-to-newest ordering. - Transaction helper commits on success and
rolls back on failure. - Concurrent action-selection attempts cannot
create two active actions.

**Acceptance checks** - \[ \] Repository tests pass against a dedicated
PostgreSQL database. - \[ \] No service depends on unparameterized
SQL. - \[ \] Transaction boundaries are explicit and testable.

**Deliverable:** Repository layer and transaction helper.

### Step 4 --- Customer and case read APIs

**Goal:** Unblock frontend screens with canonical read-only data.

**Dependencies:** Steps 1--3.

**Routes** - `GET /api/v1/customers` -
`GET /api/v1/cases?customerId={uuid}&status=open,in_progress,escalated` -
`GET /api/v1/cases/:caseId` - `GET /api/v1/cases/:caseId/timeline` -
`GET /api/v1/cases/:caseId/handoff-summary`

**Tasks** 1. Implement each route exactly as the Shared Contract defines
it. 2. Validate UUIDs and supported status filters. 3. Return only
fields allowed by the contract. 4. Return `404 NOT_FOUND` for unknown
cases. 5. Return timeline events in chronological order, oldest first.
6. Return handoff summary fields from persisted case facts; do not call
the AI service to reconstruct the summary on every read. 7. Keep list
responses concise and detail responses complete. 8. Do not expose
database internals or undocumented fields.

**Tests** - Customer list returns seeded customers without requiring
hardcoded frontend IDs. - Case filters return only matching
customer/status records. - Unknown UUID-shaped case IDs return 404. -
Malformed UUIDs return 400. - Timeline order and handoff-summary
response match the contract. - Read-only endpoints continue working when
AI is stopped.

**Acceptance checks** - \[ \] All read routes match the Shared
Contract. - \[ \] Frontend can consume the routes using contract
fixtures. - \[ \] Read APIs do not mutate case state.

**Deliverable:** Working customer, case, timeline, and handoff-summary
read APIs.

### Step 5 --- AI HTTP client and safe fallback behavior

**Goal:** Integrate the Python AI service through its agreed internal
contract without giving it authority over state.

**Dependencies:** Steps 0--3. The AI team can implement its service in
parallel.

**Required endpoints** - `POST /internal/v1/classify` -
`POST /internal/v1/match-case` - `POST /internal/v1/extract-outcome`

**Tasks** 1. Implement one typed client method per endpoint. 2. Use
`AI_SERVICE_URL` and a short configurable request timeout (default 5
seconds, aligned with the AI PRD). 3. Validate every response before
returning it to services. 4. Reject unknown category/outcome enums and
confidence values outside `[0, 1]`. 5. For case matching, reject any
`matchedCaseId` not included in the supplied candidates. 6. Never send
database credentials, API secrets, or unnecessary customer information
to the AI service. 7. Log endpoint, request ID, duration, and outcome
status; avoid logging secrets or full provider responses. 8. Use a
deterministic fake AI client in unit/API tests. 9. When AI is
unavailable: - Read-only APIs continue to work. - Explicit UI-submitted
action outcomes continue to work. - An obviously in-scope first message
may use a conservative deterministic keyword fallback. - Ambiguous
messages require clarification. - Do not invent a semantic match or
claim an outcome succeeded. - Return `503 AI_UNAVAILABLE` only when no
safe fallback applies. 10. Do not introduce PRD 1's
`/v1/analyze-message`, `/v1/phrase-step`, or `/v1/summarize-case`
endpoints unless the Shared Contract is deliberately changed first.

**Tests** - Valid and invalid AI response schemas. - Timeout and
connection failure. - Invalid candidate ID is rejected. - Safe fallback
for obvious connectivity language. - Ambiguous first message prompts
clarification. - Explicit outcome processing works with AI stopped. - No
live AI credentials or network are needed for default tests.

**Acceptance checks** - \[ \] The client calls only the three
contract-defined internal endpoints. - \[ \] Backend remains the
authority for all decisions. - \[ \] Fallbacks do not create unsupported
claims or false outcomes.

**Deliverable:** Typed AI client and mocked client for tests.

### Step 6 --- Session creation and contact-count policy

**Goal:** Implement the meaning of a contact consistently.

**Dependency:** Steps 2--5.

**Route:** `POST /api/v1/sessions`

**Algorithm** 1. Validate `customerId` as a UUID. 2. Confirm the
customer exists; otherwise return 404. 3. Begin a transaction and insert
the new chat session. 4. Find the customer's most recently updated
unresolved case with status `open` or `in_progress`. 5. If no unresolved
case exists, leave `session.case_id` null and return the contract
response with `case: null`, `escalationRequired: false`, and
`handoffSummary: null`. 6. If an unresolved case exists, lock the case
row, attach the new session, increment `contact_count` exactly once,
update `last_contact_at`, and append `contact_started`. 7. If the new
count is `>= 3`, invoke the idempotent escalation service in the same
transaction. Do not recommend a new action. 8. Return the session and
canonical case state, including escalation fields required by the
contract. 9. A message sent within an existing session must never
increment contact count. 10. A newly created case starts at contact
count 1; do not count its initial session twice.

**Concurrency and idempotency** - Lock the relevant case before
incrementing the count. - Avoid double increments from duplicate/retried
session-creation requests according to the idempotency mechanism agreed
by the team. - If a request idempotency key is added, document it
without changing the public response schema.

**Tests** - New customer session with no case. - New session linked to
unresolved case increments once. - Third session escalates before
another action is returned. - Resolved/escalated cases are not treated
as resumable unresolved cases. - Repeated messages in one session do not
affect contact count. - Concurrent session creation cannot lose or
duplicate an increment.

**Acceptance checks** - \[ \] Contact count is a count of sessions, not
messages. - \[ \] Third contact response includes
`escalationRequired: true` and a summary. - \[ \] Contact increment and
event insertion are atomic.

**Deliverable:** Session creation service and route.

### Step 7 --- Playbook service and action eligibility

**Goal:** Make action selection deterministic and independent of AI
output.

**Dependencies:** Steps 2--5.

**Stable playbook order** 1. `router_power_cycle` 2.
`check_cables_lights` 3. `check_area_outage` 4. `test_another_device` 5.
`remote_line_reset` 6. `book_technician`

Use the exact labels, instructions, order, and mocked-action wording
from Shared Contract Section 4.5. Do not rename step keys.

**Implement `selectNextEligibleAction(caseId, transaction)`** 1. Lock
the case row. 2. Confirm the case is `open` or `in_progress`; do not
select an action for escalated, resolved, or closed cases. 3. Check for
an existing action with status `recommended`, `attempted`, or `unknown`.
If one exists, return it as the current action rather than creating
another. 4. Read the six playbook steps in ascending `step_order`. 5.
Exclude steps already marked `failed` or `succeeded` for this case. 6.
Never recommend a failed step again in the same case, including after a
new session. 7. If no eligible step remains and the case is unresolved,
escalate with reason `playbook_exhausted`. 8. Otherwise insert an
`action_ledger` row with status `recommended`, update
`current_step_key`, set case status to `in_progress`, append
`action_recommended`, and commit as part of the calling operation. 9.
Return the persisted action record. Never return an unpersisted action
as if it were canonical. 10. Only this service may select the next step.

**Tests** - First eligible action is `router_power_cycle`. - Failed
first step advances to `check_cables_lights`. - Failed/succeeded steps
are excluded. - Unknown action blocks a new recommendation. - Two
concurrent calls cannot create two active actions. - Exhausted playbook
triggers escalation once.

**Acceptance checks** - \[ \] Selection is deterministic and follows
playbook order. - \[ \] No failed step can reappear for the same case. -
\[ \] At most one action is awaiting an outcome.

**Deliverable:** Playbook service and exhaustive unit tests.

### Step 8 --- Message processing and case continuity

**Goal:** Implement the primary customer interaction without duplicating
case logic.

**Route:** `POST /api/v1/sessions/:sessionId/messages`

**Input validation** - Validate the session UUID. - Require a non-empty
message after trimming whitespace. - Enforce a reasonable maximum length
(2,000 characters recommended unless the Shared Contract specifies
otherwise). - Return the canonical error envelope for invalid requests
or unknown sessions.

**Algorithm** 1. Load the session and customer. 2. Record the inbound
message in the appropriate history/event model. If a case is already
attached, associate the event with that case. 3. If the session has no
case: - Call AI `classify`. - If `off_topic`, return the fixed scope
response and do not create a case. - If `uncertain`, return a
clarification response and do not create a case. - If
`internet_connectivity`, create the case with `contact_count = 1`,
attach the session, write `case_created` and `contact_started` events,
and select the first eligible action. 4. If the session already has a
case: - If escalated, return the existing handoff summary and stop
automated troubleshooting. - If resolved or closed, do not silently
reopen it. Ask whether the customer has a new issue; a confirmed new
issue should use a new session and a new case. - If open or in progress,
continue the existing case and use AI matching only when needed to
disambiguate among supplied candidates. 5. For matching, only send
candidates belonging to the currently selected customer and eligible for
automated continuity. Never merge cases across customers. 6. Apply the
Shared Contract thresholds: - Confidence `>= 0.80`: backend may
auto-match only if exactly one eligible candidate exists. - Confidence
`0.55–0.79`: require user confirmation. - Confidence `< 0.55`: no
confident match. - Multiple plausible candidates: ask for confirmation
rather than guessing. 7. If an action is currently `recommended`,
`attempted`, or `unknown`, do not issue a second action. Use the current
action and ask for an outcome or clarification. 8. Do not ask AI to
choose or reorder playbook steps. 9. Return `sessionId`, canonical
`case` (or null), `reply`, `recommendedAction` (or null), and
`needsOutcome` exactly as the Shared Contract defines. 10. Ensure the
message result and all related state changes are persisted consistently.
Use transactions for case creation, initial action recommendation, and
event insertion. 11. Do not let AI outage behavior violate the
safe-fallback policy in Step 5.

**Fixed scope response** Use the exact text and response kind in the
Shared Contract. Do not create a case for an off-topic first message.

**Clarification response** Use the exact contract response kind and
shape. Do not create a case until the issue is sufficiently classified.

**Tests** - In-scope first message creates one case with contact count 1
and recommends the first action. - Off-topic first message creates no
case. - Uncertain message asks for clarification and creates no case. -
Returning customer resumes the correct unresolved case. - Candidate
matching cannot cross customer boundaries. - Ambiguous matching asks for
confirmation. - Escalated case does not continue troubleshooting. -
Resolved case is not silently reopened. - AI timeout uses safe fallback
or returns `AI_UNAVAILABLE` when no safe fallback exists.

**Acceptance checks** - \[ \] The message endpoint matches the Shared
Contract. - \[ \] A single message never increments contact count. - \[
\] No duplicate case is created for a clear recurrence. - \[ \] Message
processing cannot bypass action eligibility or escalation rules.

**Deliverable:** Message service and route with contract-based fixtures.

### Step 9 --- Action outcome endpoint and transitions

**Goal:** Record outcomes through the explicit API used by the frontend.

**Route:** `POST /api/v1/cases/:caseId/actions/:actionId/outcome`

**Request fields** - `outcome`: one of `failed`, `succeeded`,
`unknown`. - `customerNote`: optional text as allowed by the Shared
Contract.

**Algorithm** 1. Validate case ID, action ID, request body, and outcome
enum. 2. Start a transaction and lock the case and action rows. 3.
Verify that the action belongs to the specified case. 4. Reject outcome
changes for escalated, resolved, or closed cases as defined by the
contract. 5. If the action already has the same terminal outcome, return
the current state without duplicating events. 6. If a terminal action
receives a conflicting terminal outcome, return `409 CONFLICT`. 7.
Persist the outcome, `outcome_at`, optional note, and
`action_outcome_recorded` event. 8. For `succeeded`: - Set action status
to `succeeded`. - Set case status to `resolved`. - Set `resolved_at`. -
Clear `current_step_key`. - Append `case_resolved`. - Return
`recommendedAction: null`. 9. For `failed`: - Set action status to
`failed`. - Permanently exclude its step key for this case. - Select the
next eligible action. - If no action remains, escalate with
`playbook_exhausted`. 10. For `unknown`: - Persist `unknown`. - Keep the
current action unresolved. - Return a clarification reply. - Do not
advance the playbook. - Allow later clarification to change `unknown` to
`failed` or `succeeded`. 11. Commit outcome, events, next action or
escalation atomically. 12. Return canonical case state, reply, and
recommended action in the exact contract shape.

**AI-assisted extraction** - Explicit UI buttons are the primary source
of outcomes. - AI extraction may assist when the customer reports an
outcome in free text. - `not_provided` is not a persisted customer
outcome. - Never infer success from "I did it" or from an ambiguous
statement. - Low-confidence AI extraction must not trigger a state
transition. - Validate the action is still current before applying an
extracted outcome.

**Tests** - Failed outcome records history and returns the next
action. - Succeeded outcome resolves the case and returns no action. -
Unknown outcome blocks advancement and can later be clarified. -
Duplicate same outcome does not duplicate events. - Conflicting terminal
outcome returns 409. - Action belonging to a different case is
rejected. - AI-offline explicit outcome submission succeeds. -
Concurrent outcome requests produce one canonical transition.

**Acceptance checks** - \[ \] Frontend can use the explicit outcome
endpoint from its PRD. - \[ \] Outcome update, event, and next
transition are atomic. - \[ \] `unknown` never silently advances the
playbook.

**Deliverable:** Outcome service and endpoint.

### Step 10 --- Escalation and handoff summary

**Goal:** Stop automated troubleshooting deterministically and preserve
a useful, truthful summary.

**Escalation reasons** - `contact_limit_reached` - `playbook_exhausted`

**Implement `escalateCase(caseId, reason, transaction)`** 1. Lock the
case row. 2. If already escalated, return its existing summary without
appending another escalation event. 3. If resolved or closed, do not
escalate. 4. Set status to `escalated`. 5. Clear `current_step_key`. 6.
Build a summary from persisted case facts, actions, and events; do not
ask the LLM to decide which facts matter. 7. Store the summary in
`handoff_summary`. 8. Append exactly one `case_escalated` event with the
reason in metadata. 9. Commit status, summary, and event atomically. 10.
Return canonical case and summary.

**Required summary contents** - Case ID and issue title. - Current
problem summary. - Contact count. - Case creation and latest-contact
timestamps. - Chronological timeline. - Every recommended playbook step
and its recorded outcome. - All failed steps. - Escalation reason. -
Explicit notice that mocked actions were simulations when they appear in
history.

**Behavior after escalation** - Do not issue more troubleshooting
actions. - Message processing for the escalated case returns the
existing handoff summary and stops the troubleshooting flow. - The
frontend must be able to display the reason, summary, contact count,
failed steps, and timeline. - The UI must say this is a simulated
handoff; no human agent has actually been notified.

**Tests** - Third contact escalates before another recommendation. -
Exhausted playbook escalates. - Repeated escalation calls do not
duplicate events. - Resolved/closed cases are not escalated. - Summary
contains failed steps, reason, contact count, and chronological
timeline. - Mocked external actions are clearly labelled as simulated.

**Acceptance checks** - \[ \] Escalation is idempotent. - \[ \] The
summary is generated from persisted facts. - \[ \] Escalated cases
cannot receive new troubleshooting actions.

**Deliverable:** Escalation service, handoff-summary service, and route
integration.

### Step 11 --- Timeline, event completeness, and auditability

**Goal:** Make every important case transition explainable in the UI.

**Tasks** 1. Append events for case creation, contact start, received
messages, assistant responses, action recommendations, action outcomes,
escalation, resolution, and summary generation where required by the
Shared Contract. 2. Use only the allowed event type values. 3. Keep
events append-only. 4. Include useful metadata such as `stepKey`,
`outcome`, and escalation reason. 5. Associate events with `caseId` and
`sessionId` when applicable. 6. Return timeline events oldest to newest.
7. Ensure one logical transition does not create duplicate events when a
request is retried. 8. Avoid putting secrets or unnecessary personal
data in event metadata.

**Tests** - Each state transition creates the expected event(s). -
Timeline order is stable. - Duplicate outcome and escalation requests do
not duplicate terminal events. - Event metadata uses contract field
names and safe values.

**Acceptance checks** - \[ \] Timeline can reconstruct the meaningful
history of a case. - \[ \] Events are not deleted when case status
changes. - \[ \] Frontend can render timeline fixtures without custom
interpretation.

**Deliverable:** Complete event coverage and timeline tests.

### Step 12 --- Dashboard metrics

**Goal:** Provide metrics from persisted backend records, not
frontend-derived state.

**Route:** `GET /api/v1/dashboard/metrics`

Implement the exact Shared Contract definitions: - `totalCases`: all
cases. - `openCases`: cases whose status is `open` or `in_progress`. -
`escalatedCases`: cases whose status is `escalated`. - `resolvedCases`:
cases whose status is `resolved`. - `repeatContactRate`: cases with
`contact_count >= 2` divided by cases with at least one contact. -
`repeatedRecommendationRate`: recommendations whose `stepKey` had
previously been marked failed in the same case divided by all
recommendations.

Rules: 1. Rates are decimal numbers from 0.0 to 1.0, not percentage
integers. 2. If a denominator is zero, return `0.0`. 3. The
repeated-recommendation rate should remain zero during valid operation;
a non-zero value indicates a defect. 4. Calculate metrics from database
records. 5. Document that `openCases` includes both `open` and
`in_progress`. 6. Do not invent a threshold for when the
repeated-recommendation metric becomes alarming.

**Tests** - Correct counts and rates for representative fixtures. -
Empty database returns zeros, not null or NaN. - Failed step is not
counted as a repeated recommendation unless it is actually recommended
again. - Metrics remain consistent after resolution and escalation.

**Acceptance checks** - \[ \] Metric response matches the Shared
Contract exactly. - \[ \] Frontend can format decimal rates as
percentages. - \[ \] Metrics do not depend on frontend-local state.

**Deliverable:** Metrics service and endpoint.

### Step 13 --- Concurrency, idempotency, and failure recovery

**Goal:** Prevent race conditions from corrupting the case ledger.

**Tasks** 1. Lock case rows when incrementing contact count or
selecting/updating an action. 2. Make session creation, contact
increment, and `contact_started` event atomic. 3. Make action outcome,
outcome event, next action selection, and possible escalation atomic. 4.
Make escalation status, handoff summary, and escalation event atomic. 5.
Make case creation, initial session attachment, initial events, and
first action recommendation atomic. 6. Ensure transaction failures roll
back all writes in that business operation. 7. Ensure retries cannot
double-increment contact count or duplicate terminal outcome/escalation
events. 8. Document any idempotency-key strategy; do not change public
API shapes without a contract change. 9. Handle unique-constraint
violations as controlled conflicts or internal defects as appropriate;
never return raw SQL errors.

**Tests** - Two simultaneous requests cannot create two active
actions. - Concurrent outcome submissions cannot advance the playbook
twice. - Concurrent session creation cannot lose or duplicate contact
increments. - Forced failure midway through a transaction leaves no
partial state. - Repeated same terminal outcome is idempotent. -
Escalation remains idempotent under concurrent calls.

**Acceptance checks** - \[ \] Database invariants hold under concurrent
requests. - \[ \] Every multi-write transition is atomic. - \[ \] Errors
are safe and observable through request IDs and structured logs.

**Deliverable:** Concurrency and rollback tests.

### Step 14 --- Independent backend test suite

**Goal:** Make backend correctness verifiable without the AI or frontend
services.

**Test setup** - Use Vitest/Jest and Supertest for route tests. - Import
`app.js` without starting `server.js`. - Mock the AI client for unit and
API tests. - Use a dedicated PostgreSQL database for
repository/transaction tests. - `npm test` must not require Python, API
keys, paid provider access, or internet. - Separate live-provider smoke
tests from the default test suite.

**Required unit tests** - Contact count: first case starts at 1; new
session increments once; messages do not increment. - Action selector
excludes failed/succeeded steps. - An outstanding
recommended/attempted/unknown action blocks a second recommendation. -
Unknown can later become failed or succeeded; terminal outcomes cannot
conflict. - Escalation is idempotent. - Handoff summary includes failed
steps and reason. - Metrics return `0.0` when denominators are zero. -
AI validator rejects invalid enums, confidence values, and invented case
IDs. - Matching thresholds behave at boundary values 0.55 and 0.80. -
Playbook has exactly six steps in contract order.

**Required API tests** 1. Invalid UUID returns 400 with canonical
envelope. 2. Unknown customer/session/case/action returns 404. 3.
Off-topic first message creates no case. 4. In-scope first message
creates one case and recommends `router_power_cycle`. 5. Uncertain first
message asks for clarification and creates no case. 6. Repeated messages
in the same session do not increase `contactCount`. 7. Failed
`router_power_cycle` causes `check_cables_lights` to be recommended
next. 8. Failed step is never recommended again, including across
sessions. 9. Succeeded outcome resolves the case and returns no
recommended action. 10. Unknown outcome does not advance the playbook.
11. Third session escalates before another action is returned. 12.
Playbook exhaustion escalates. 13. Same outcome retry is idempotent. 14.
Conflicting terminal outcome returns 409. 15. AI timeout follows safe
fallback/clarification behavior. 16. Invalid body and unsupported
outcome return 400. 17. Read-only case routes and explicit outcomes work
when AI is offline. 18. Dashboard empty state returns zero counts/rates.
19. Handoff summary route returns persisted summary. 20. No endpoint
exposes internal stack traces or secrets.

**Acceptance checks** - \[ \] Unit and API tests pass without AI
service. - \[ \] Database-backed tests pass against a dedicated test
database. - \[ \] Tests cover both happy paths and contract-defined
error paths.

**Deliverable:** Automated backend suite suitable for CI and local
development.

### Step 15 --- Compose integration and cross-team acceptance

**Goal:** Verify that the backend works with the actual AI and frontend
implementations.

**Dependencies:** Steps 0--14 and independent AI/frontend suites.

**Tasks** 1. Confirm each component's independent tests pass first. 2.
Start PostgreSQL, backend, AI service, and frontend with Docker Compose.
3. Confirm service-to-service calls use Compose service names. 4. Run
the full user journey: - Select one seeded customer. - Start a
session. - Send an in-scope connectivity complaint. - Verify case
creation and first action. - Submit a failed outcome. - Verify next
action and timeline. - Submit unknown and verify no advancement. -
Clarify unknown to failed or succeeded. - Start a new session and verify
contact count. - On the third contact, verify escalation and summary. -
Verify dashboard metrics. - Verify off-topic and uncertain first
messages do not create cases. 5. Test with AI mock provider first; live
free-tier provider is an optional manual smoke test. 6. Verify frontend
polling does not create backend writes or increment contact count. 7.
Verify all mock ISP operations are described honestly as simulations. 8.
Record any integration bug against the owning component and fix the
contract mismatch rather than adding an undocumented workaround.

**Acceptance checks** - \[ \] All component suites pass independently. -
\[ \] Database-backed tests pass. - \[ \] Full Compose demo succeeds
with mock AI and no API key. - \[ \] Frontend never calls the AI service
directly. - \[ \] AI service has no database access. - \[ \] Public API
and internal AI calls match their contracts. - \[ \] The end-to-end demo
follows the Shared Contract.

**Deliverable:** Repeatable integration-test/demo instructions in
`backend/README.md` and the repository README.

### Step 16 --- Documentation and handoff

**Goal:** Make it possible for another developer to run, test, and
extend the backend safely.

**README must include** - Prerequisites and supported Node.js version. -
Environment variables and safe `.env` setup. - Database migration, seed,
and reset commands. - How to run the backend locally and through
Compose. - How to run unit, API, and database-backed tests. - Route
inventory linking to the Shared Contract. - AI mock/fallback behavior. -
Demo flow and expected results. - Known Phase 1 limitations and
simulated actions. - How to propose a contract change.

**Acceptance checks** - \[ \] A teammate can start the backend from a
clean checkout. - \[ \] A teammate can run tests without AI
credentials. - \[ \] Reset instructions are safe and clear. - \[ \]
README does not contradict the Shared Contract.

**Deliverable:** `backend/README.md`, clean `.env.example`, and final
task checklist.

## 5. Public route checklist

Implement the exact schemas in the Shared Contract; this list is for
tracking, not permission to change route shapes.

  ---------------------------------------------------------------------------------------------------
  Method                  Route                                               Purpose
  ----------------------- --------------------------------------------------- -----------------------
  GET                     `/api/v1/health`                                    Backend health

  GET                     `/api/v1/customers`                                 Seeded customer
                                                                              selector

  GET                     `/api/v1/cases`                                     Filter cases by
                                                                              customer/status

  GET                     `/api/v1/cases/:caseId`                             Case detail

  GET                     `/api/v1/cases/:caseId/timeline`                    Ordered event history

  GET                     `/api/v1/cases/:caseId/handoff-summary`             Persisted handoff
                                                                              summary

  POST                    `/api/v1/sessions`                                  Start chat and apply
                                                                              contact policy

  POST                    `/api/v1/sessions/:sessionId/messages`              Process customer
                                                                              message

  POST                    `/api/v1/cases/:caseId/actions/:actionId/outcome`   Record action outcome

  GET                     `/api/v1/dashboard/metrics`                         Persisted metrics
  ---------------------------------------------------------------------------------------------------

Do not add an alternate route for the same operation unless the Shared
Contract is updated first.

## 6. Data and state invariants

These invariants must hold after every successful operation:

1.  Each case belongs to one seeded customer.
2.  A session may exist before a case is created.
3.  A new case starts with `contactCount = 1`.
4.  A contact is a new session, not an individual message.
5.  A new session linked to an unresolved case increments its count
    once.
6.  A case escalates at contact count 3 or greater before another
    troubleshooting action is returned.
7.  An escalated case does not continue automated troubleshooting.
8.  A failed step is never recommended again for that case.
9.  A succeeded step is not recommended again for that case.
10. Only one action may be active (`recommended`, `attempted`, or
    `unknown`) for a case.
11. An unknown action remains unresolved and blocks the next action.
12. Success resolves the case and clears `currentStepKey`.
13. Playbook exhaustion escalates an unresolved case.
14. Escalation is idempotent and creates only one escalation event.
15. Case events are append-only and chronologically retrievable.
16. Handoff summary is derived from persisted facts and never implies a
    real human was notified.
17. Frontend-provided status, count, step order, or case match is never
    trusted as authoritative.
18. AI cannot choose a playbook step or directly change state.
19. Read-only APIs and explicit UI outcome submission remain available
    when AI is offline.
20. Rates returned by the metrics endpoint are decimals from 0.0 to 1.0.

## 7. Cross-team contract checklist

Before merging backend work, verify the following with the other teams.

### With the AI team

-   [ ] Endpoint paths and methods exactly match the Shared Contract.
-   [ ] Request and response models match field names and nullability.
-   [ ] Classification categories are `internet_connectivity`,
    `off_topic`, or `uncertain`.
-   [ ] Match IDs must come from the supplied candidate list.
-   [ ] Outcome extraction supports `failed`, `succeeded`, `unknown`,
    and `not_provided`.
-   [ ] Confidence validation and matching thresholds are enforced by
    Node.js.
-   [ ] AI service does not connect to PostgreSQL.
-   [ ] Default tests run with a fake provider and no API key.

### With the frontend team

-   [ ] Frontend calls only `/api/v1` backend routes.
-   [ ] Customer IDs are fetched from the API, not hardcoded.
-   [ ] Action outcomes use the explicit outcome endpoint.
-   [ ] Frontend renders the backend's returned case, reply, and action.
-   [ ] Frontend does not select actions, increment contacts, or
    determine case status.
-   [ ] Unknown outcome keeps the current action pending clarification.
-   [ ] Third-contact escalation displays the handoff summary and
    disables troubleshooting.
-   [ ] Dashboard rates are interpreted as decimals and formatted by the
    UI.
-   [ ] Polling does not create new sessions or mutate state.

## 8. Definition of done

The backend is done for Phase 1 only when all of the following are true:

-   [ ] Every route matches the Shared Contract.
-   [ ] Migrations and seed/reset scripts work from a clean database.
-   [ ] Three demo customers and six stable playbook steps are present.
-   [ ] Case creation, continuity, matching, action outcomes, and
    escalation are implemented in services.
-   [ ] No failed action can be recommended again for the same case.
-   [ ] Unknown outcomes do not advance the playbook.
-   [ ] Third contact escalates before another action is returned.
-   [ ] Handoff summary and timeline are persisted and correct.
-   [ ] Dashboard metrics match the contract definitions.
-   [ ] AI safe-failure behavior is tested.
-   [ ] Transaction and concurrency tests pass.
-   [ ] Backend tests run without Python, API keys, or external network.
-   [ ] Full Docker Compose integration succeeds with mock AI.
-   [ ] README and `.env.example` are complete and safe.

## 9. Change-management rule

If implementation reveals a missing or contradictory requirement:

1.  Identify the exact Shared Contract section and affected
    endpoint/state transition.
2.  Propose the smallest contract change that resolves it.
3.  Review the change with backend, AI, and frontend owners.
4.  Update `00_SHARED_CONTRACT.md` first.
5.  Update affected backend, AI, and frontend PRDs and fixtures
    together.
6.  Add or update tests that prove the new behavior.
7.  Do not silently work around the contract in one service.

The Shared Contract remains authoritative throughout Phase 1.
