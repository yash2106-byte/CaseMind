# Case Continuity Engine, Backend Roadmap

**Stack:** Node.js, Express, PostgreSQL (pgvector image), Zod/Vitest/Supertest
**Scope:** Backend only. You own the API, the database, and every decision about cases.
**Authority:** `00_SHARED_CONTRACT.md` always wins over this roadmap and over the Backend PRD.

---

## 0. How to Use This Document

This is an ordered build list. Do the phases in order. Do not start a phase until the "Done when" checklist of the previous one is ticked.

For every phase:

1. Read the contract sections listed under "Read first".
2. Build only what the phase lists. Nothing extra.
3. Write the tests for that phase.
4. Tick the checklist.
5. Commit.

Ask yourself in every phase:

- What does the contract say exactly? (route, field, enum, text)
- What state should the case be in after this operation?
- What if the same request arrives twice?
- What if two requests arrive at the same time?
- What if the AI service is down?
- How would I prove it works with a test?

---

## 1. What You Are Building

A backend that remembers a customer's unresolved internet problem across chat sessions, so the bot never repeats a failed step and escalates on time.

```
 Frontend (React)  --HTTP /api/v1-->  YOUR BACKEND (Node)  --internal HTTP-->  AI service (Python)
                                           |
                                           v
                                      PostgreSQL
```

Your backend is the boss:

| You decide | The AI only suggests |
|---|---|
| Create a case or not | Is this message about internet? |
| Which playbook step is next | Which candidate case might match? |
| Contact count | What outcome did the user describe? |
| Escalation | (nothing else) |
| Final outcome saved | |

The browser never talks to the AI. The AI never touches the database.

---

## 2. Facts to Memorize Before Coding

**Playbook (fixed order, fixed keys):**

1. `router_power_cycle`
2. `check_cables_lights`
3. `check_area_outage` (mocked)
4. `test_another_device`
5. `remote_line_reset` (mocked)
6. `book_technician` (mocked)

**Case statuses:** `open`, `in_progress`, `escalated`, `resolved`, `closed`

**Action statuses:** `recommended`, `attempted`, `failed`, `succeeded`, `unknown`, `skipped`

**Customer outcomes:** `failed`, `succeeded`, `unknown` only

**Event types (10):** `case_created`, `contact_started`, `message_received`, `assistant_response`, `action_recommended`, `action_outcome_recorded`, `case_escalated`, `case_resolved`, `case_reopened`, `summary_generated`

**Error codes:** `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `CONFLICT` (409), `AI_UNAVAILABLE` (503), `INTERNAL_ERROR` (500)

**Reply kinds in the contract:** `troubleshooting`, `scope`, `clarification`

**Escalation reasons:** `contact_limit_reached`, `playbook_exhausted`

**Thresholds:** match confidence >= 0.80 auto (only if exactly one candidate), 0.55 to 0.79 ask user, < 0.55 no match

**The 10 routes:**

| Method | Path |
|---|---|
| GET | /health |
| GET | /customers |
| GET | /cases |
| GET | /cases/:caseId |
| GET | /cases/:caseId/timeline |
| GET | /cases/:caseId/handoff-summary |
| POST | /sessions |
| POST | /sessions/:sessionId/messages |
| POST | /cases/:caseId/actions/:actionId/outcome |
| GET | /dashboard/metrics |

**The 3 AI endpoints you call:** `/internal/v1/classify`, `/internal/v1/match-case`, `/internal/v1/extract-outcome`

---

## 3. The Core Lifecycle (the backbone)

```
 New session
     |
     +-- customer has unresolved case? --yes--> attach, contactCount + 1
     |                                              |
     |                                       count >= 3? --yes--> ESCALATE (no new step)
     no
     |
 session with no case
     |
 first message --> classify
     |
     +-- off_topic ------> scope reply, NO case
     +-- uncertain ------> clarification reply, NO case
     +-- internet --------> create case (count = 1) --> recommend step 1

 Action outcome
     |
     +-- succeeded --> case resolved, no more steps
     +-- failed ------> exclude step forever --> next step --> none left? ESCALATE
     +-- unknown -----> stay on same step, ask to clarify, do NOT advance
```

Memorize these rules:

- A contact is a new session, never a message.
- A new case starts at count 1, not 2.
- Only one action may be waiting for an outcome (`recommended`, `attempted`, or `unknown`).
- `failed` and `succeeded` are final. `unknown` can later become either.
- Escalation happens once and is safe to repeat.

---

## 4. Phase 0: Align With the Contract and the Teams

**Read first:** whole Shared Contract, then Backend PRD Step 0.

**Goal:** Remove all guessing before you write code.

**What to do**

1. Read the Shared Contract fully, twice.
2. Make a one-page cheat sheet with the lists from Section 2.
3. Collect every example JSON in the contract into a fixtures folder (you will reuse them in tests).
4. Message the AI and frontend owners and agree on the contract version (currently 1.1).
5. Raise the open questions in Section 17 with the team lead and get answers written down.

**Done when**

- [ ] Cheat sheet exists
- [ ] Fixtures folder exists with all contract examples
- [ ] All three teams confirmed contract version 1.1
- [ ] Open questions logged with answers or owners

---

## 5. Phase 1: Project Skeleton

**Read first:** Contract sections 3, 7.1, 7.11. PRD Steps 1 and 3.

**Goal:** A running Express app with health check and correct errors. No database yet.

**What to do**

1. Create the Node project and pick one Node version (20 or 22) for everywhere.
2. Create the folder layout from the PRD (routes, controllers, services, repositories, clients, db, schemas, middleware, lib).
3. Create `.env.example` with the variables listed in the PRD. Validate them at startup.
4. Separate "build the app" from "start the server" so tests can import the app.
5. Add request IDs to every request.
6. Add the central error handler that outputs the contract's error format.
7. Add the unknown-route 404 in the same format.
8. Add CORS for the frontend origin only.
9. Add structured JSON logging.
10. Build `GET /api/v1/health`.
11. Set up Vitest and Supertest.

**Done when**

- [ ] Health returns `{ "status": "ok" }`
- [ ] Unknown route returns the standard 404 error with a requestId
- [ ] Bad JSON returns a standard 400, not a crash
- [ ] No stack trace ever appears in a response
- [ ] `npm test` runs without starting a server

---

## 6. Phase 2: Database Schema, Constraints, Seed

**Read first:** Contract sections 4 and 8. PRD Step 2.

**Goal:** The six tables exist exactly as the contract says, and the database itself refuses invalid data.

**What to do**

1. Set up PostgreSQL using a pgvector-capable image.
2. Create versioned migrations for: `customers`, `cases`, `chat_sessions`, `case_events`, `action_ledger`, `playbook_steps`.
3. Copy every column, default, nullability, foreign key, and check constraint from contract section 8.
4. Add the indexes the contract lists.
5. Add the rule that only one active action (recommended, attempted, unknown) can exist per case.
6. Seed 3 customers and the 6 playbook steps (exact labels and instructions from contract 4.5, with the three mocked ones flagged).
7. Write a repeatable seed script and a reset script.
8. Make the reset script refuse to run outside development/test.

**Done when**

- [ ] Empty database migrates cleanly
- [ ] Seed gives exactly 3 customers and 6 ordered steps
- [ ] Database rejects: contact count below 1, bad status, bad step order, orphan rows
- [ ] Database rejects a second active action for the same case
- [ ] Reset is blocked in production mode

---

## 7. Phase 3: Database Access Layer and Transactions

**Read first:** Contract 8.3. PRD Step 3.

**Goal:** One central place for all SQL, plus a safe way to do multi-step changes.

**What to do**

1. Create the connection pool.
2. Create a transaction helper that commits on success and rolls everything back on error.
3. Create one repository per table.
4. Add the operations your services will need:
   - get customer, list customers
   - find latest unresolved (`open`/`in_progress`) case for a customer
   - load a case with its actions and events
   - list cases with filters
   - list match candidates for one customer
   - read a case's action history and find its active action
   - insert/update action
   - append event
   - metrics queries (can wait until Phase 11)
5. Make every operation that changes data accept the transaction so several changes commit together.
6. Map database names (snake_case) to API names (camelCase) in one place.

**Rules**

- Never put user input directly into SQL text.
- Routes never contain SQL.

**Done when**

- [ ] Repository tests pass on a separate test database
- [ ] Timeline comes back oldest first
- [ ] Queries are scoped to the given customer
- [ ] A failed transaction leaves zero partial changes

---

## 8. Phase 4: Read-Only APIs

**Read first:** Contract 7.2, 7.3, 7.7, 7.8, 7.10. PRD Step 4.

**Goal:** Let the frontend team build their screens against real data.

**Build in this order**

1. `GET /customers`
2. `GET /cases?customerId=&status=` (comma-separated statuses)
3. `GET /cases/:caseId`
4. `GET /cases/:caseId/timeline`
5. `GET /cases/:caseId/handoff-summary`

**Rules**

- Validate UUIDs and status values (400 if invalid).
- Unknown but valid UUID returns 404.
- Return only the fields the contract lists.
- These routes never change data and never call the AI.
- The handoff summary is read from saved data, not regenerated.

**Done when**

- [ ] Every response shape matches the contract examples
- [ ] 400 vs 404 behave correctly
- [ ] Works with the AI service stopped
- [ ] Frontend owner confirms they can use it

---

## 9. Phase 5: Playbook Service (choosing the next step)

**Read first:** Contract 4.5, 5.3, 5.4. PRD Step 7.

**Goal:** One function that decides the next step. It never uses AI.

**What to build:** "select next eligible action for a case"

**It must follow these rules, in order**

1. Lock the case.
2. If the case is escalated, resolved, or closed, do not select anything.
3. If an action is already active (recommended, attempted, unknown), return that one. Do not create another.
4. Look at the six steps in order.
5. Skip any step already failed or succeeded for this case.
6. If nothing is left and the case is unresolved, escalate with `playbook_exhausted`.
7. Otherwise save a new action as `recommended`, set the case to `in_progress`, set its current step, and add an `action_recommended` event.
8. Return the saved action, never an unsaved one.

**Done when**

- [ ] First action is `router_power_cycle`
- [ ] After failure, next is `check_cables_lights`
- [ ] A failed step never returns, even from a new session
- [ ] An `unknown` action blocks a new recommendation
- [ ] Two simultaneous calls cannot make two active actions

---

## 10. Phase 6: Escalation and Handoff Summary

**Read first:** Contract 5.5, 7.10. PRD Step 10.

**Goal:** A function that stops troubleshooting and writes the summary, safely repeatable.

**What to build:** "escalate case with reason"

**It must**

1. Lock the case.
2. If already escalated, return the existing summary and add no new event.
3. If resolved or closed, do nothing.
4. Set status to `escalated` and clear the current step.
5. Build the summary from saved data only (no AI).
6. Store the summary on the case.
7. Add exactly one `case_escalated` event with the reason.
8. Do all of this in one transaction.

**The summary must contain**

- case ID and title
- problem summary
- contact count
- created and last-contact times
- the chronological timeline
- every recommended step with its outcome
- all failed steps
- escalation reason
- a clear note that mocked steps were simulations and the handoff is simulated (no real person notified)

**Done when**

- [ ] Calling escalate twice gives one event
- [ ] Summary includes every required item
- [ ] Resolved cases cannot be escalated
- [ ] No more actions are ever returned for an escalated case

---

## 11. Phase 7: AI Client and Safe Fallbacks

**Read first:** Contract 6 and 9. PRD Step 5.

**Goal:** Talk to the AI service without ever trusting it.

**What to do**

1. Build one client function per AI endpoint (3 total).
2. Use the configured URL and timeout (default 5 seconds).
3. Validate every AI response. Reject:
   - unknown category or outcome values
   - confidence outside 0 to 1
   - a matched case ID that was not in the candidates you sent
4. Send the AI only what it needs. No secrets, no extra customer data.
5. Log endpoint, duration, and result status only.
6. Build a fake AI client for tests that returns controlled answers.
7. Define fallback behavior when AI is down or invalid:
   - clearly connectivity-related first message: simple keyword fallback may proceed
   - ambiguous message: ask for clarification
   - never invent a match, never claim an outcome succeeded
   - return 503 `AI_UNAVAILABLE` only when no safe fallback exists

**Done when**

- [ ] Valid and invalid AI responses are both tested
- [ ] Timeout and connection failure are tested
- [ ] Invented case ID is rejected
- [ ] All default tests run without Python, API keys, or internet

---

## 12. Phase 8: Create Session

**Read first:** Contract 5.1, 5.2, 7.4. PRD Step 6.

**Goal:** Implement "what counts as a contact".

**What to build:** `POST /sessions`

**Behavior**

1. Validate `customerId` (400 if bad, 404 if customer missing).
2. Save the new session.
3. Look for that customer's most recently updated `open` or `in_progress` case.
4. None found: respond with `case: null`, `escalationRequired: false`, `handoffSummary: null`.
5. Found: lock it, attach the session, add 1 to contact count (once only), update last contact time, add a `contact_started` event.
6. If the new count is 3 or more: escalate in the same transaction and do not recommend any step. Respond with `escalationRequired: true` and the summary.

**Done when**

- [ ] No case: correct empty response
- [ ] Existing case: count goes up by exactly 1
- [ ] Third session escalates before any action appears
- [ ] Escalated and resolved cases are not resumed
- [ ] Two simultaneous requests do not lose or double an increment

---

## 13. Phase 9: Process Messages

**Read first:** Contract 5.1, 6, 7.5. PRD Step 8.

**Goal:** The main customer interaction.

**What to build:** `POST /sessions/:sessionId/messages`

**Validation:** session UUID valid, message not empty after trimming, message within the max length (PRD suggests 2,000 characters; confirm with team).

**Branches to implement**

| Situation | Result |
|---|---|
| Session has no case, AI says off_topic | Fixed scope reply (`kind: scope`), no case |
| Session has no case, AI says uncertain | Clarification reply, no case |
| Session has no case, AI says internet | Create case (count 1), attach session, add `case_created` and `contact_started`, recommend step 1 |
| Session has an escalated case | Return handoff info, no troubleshooting |
| Session has a resolved/closed case | Do not reopen silently; ask if it is a new issue |
| Session has open/in_progress case | Continue it; use AI matching only to disambiguate among supplied candidates |
| An action is already active | Do not issue a second one; ask for the outcome or clarification |

**Matching rules to apply**

- Candidates only from the current customer.
- Confidence at or above 0.80 and exactly one candidate: may auto-match.
- 0.55 to 0.79, or several plausible cases: ask for confirmation.
- Below 0.55: no match.
- Boundary values 0.55 and 0.80 need tests.

**Also**

- Log inbound messages and assistant replies as events once a case exists.
- A message never changes contact count.
- Case creation, first action, and events happen in one transaction.

**Done when**

- [ ] Off-topic and uncertain create no case
- [ ] In-scope creates exactly one case and recommends `router_power_cycle`
- [ ] Many messages in one session leave contact count unchanged
- [ ] Cross-customer matching is impossible
- [ ] AI timeout follows the Phase 7 fallback rules

---

## 14. Phase 10: Record Action Outcomes

**Read first:** Contract 5.3, 5.4, 7.6. PRD Step 9.

**Goal:** The explicit outcome API the frontend buttons use.

**What to build:** `POST /cases/:caseId/actions/:actionId/outcome`

**Behavior**

1. Validate IDs, outcome value, and optional note.
2. Lock the case and action. Confirm the action belongs to the case (otherwise reject).
3. Reject changes on escalated, resolved, or closed cases (check the contract and ask the team which status code if unclear).
4. Same terminal outcome again: return current state, no duplicate event.
5. Different terminal outcome on a final action: 409 `CONFLICT`.
6. Save outcome, time, note, and an `action_outcome_recorded` event.
7. Then by outcome:
   - **succeeded:** action succeeded, case resolved, set resolved time, clear current step, add `case_resolved`, return no action.
   - **failed:** mark failed, select next step via the Phase 5 service; if none, escalate with `playbook_exhausted`.
   - **unknown:** save unknown, return a clarification reply, do not advance.
8. Everything commits together.

**AI-assisted outcomes (optional, do last)**

- Buttons are the main path.
- Free-text outcomes via AI extraction apply only if confidence is high and the action is still current.
- `not_provided` is never saved.
- "I did it" alone never counts as success.

**Done when**

- [ ] Failed returns the next step and keeps history
- [ ] Succeeded resolves the case
- [ ] Unknown blocks advancement and can later become failed or succeeded
- [ ] Repeat of same outcome adds no events
- [ ] Conflicting outcome returns 409
- [ ] Works with the AI service stopped

---

## 15. Phase 11: Timeline Completeness and Dashboard

**Read first:** Contract 4.6, 7.9. PRD Steps 11 and 12.

**Goal:** Every important change is visible, and metrics come from the database.

**Timeline checklist**

- [ ] Every transition writes the right event type
- [ ] Events are append-only
- [ ] Metadata uses the contract field names (like `stepKey`, `outcome`, escalation reason)
- [ ] Retried requests do not duplicate terminal events

**Build** `GET /dashboard/metrics` with the exact contract definitions:

- totalCases, openCases (open plus in_progress), escalatedCases, resolvedCases
- repeatContactRate and repeatedRecommendationRate as decimals 0.0 to 1.0
- zero denominator returns 0.0

**Done when**

- [ ] Empty database returns zeros, never null or NaN
- [ ] Counts and rates correct on sample data
- [ ] repeatedRecommendationRate is 0.0 in normal operation

---

## 16. Phase 12 to 14: Harden, Test Everything, Integrate

### Phase 12: Concurrency and failure
- [ ] Two simultaneous action selections create one active action
- [ ] Two simultaneous outcome submissions advance the playbook once
- [ ] Two simultaneous session creations count correctly
- [ ] Forced failure mid-transaction leaves no partial data
- [ ] Concurrent escalations create one event
- [ ] Database errors never reach the browser as raw SQL
- [ ] Decide and document an idempotency approach for retried session creation (without changing response shapes)

### Phase 13: Complete test suite audit
Check that all 20 API tests and 10 unit tests from the PRD (Step 14) exist and pass. Also confirm:
- [ ] `npm test` needs no Python, no API key, no internet
- [ ] Separate database for repository tests
- [ ] No endpoint leaks stack traces or secrets

### Phase 14: Docker Compose integration
Run with the real AI (mock provider) and frontend, then walk this journey:

1. Pick a seeded customer
2. Start session, send an internet complaint
3. Confirm case created and first step returned
4. Submit failed, confirm next step and timeline
5. Submit unknown, confirm no advancement
6. Clarify to failed or succeeded
7. Start a new session, confirm count
8. Reach the third contact, confirm escalation and summary
9. Check dashboard numbers
10. Confirm off-topic and uncertain first messages create no cases

Also confirm the frontend never calls the AI service, and polling causes no writes.

Fix mismatches by correcting the contract first, never with a private workaround.

---

## 17. Questions to Ask Your Team Now

I found these gaps while reading the contract. Get them answered in writing before you build the affected phase.

1. **Reply kinds:** only `troubleshooting`, `scope`, `clarification` are defined. What `kind` and text do we return for escalated, resolved, unknown-outcome, and "is this a new issue?" replies?
2. **Resolved/closed case on a new message:** the contract has a `case_reopened` event but no reopen flow. Is reopening in Phase 1, or ignore it?
3. **`attempted` status:** the outcome endpoint only accepts failed/succeeded/unknown. What action ever sets `attempted`? Probably unused. Confirm.
4. **Outcome on an escalated/resolved case:** which status code (409 or 400)?
5. **Duplicate field in examples:** `handoffSummary` appears twice inside the case examples. Confirm it is one field.
6. **Outcome response examples** show `actions: []` and `events: []`. Should real responses fill these in?
7. **Message length limit:** contract does not set one; PRD suggests 2,000.
8. **Mocked steps:** are the three mocked steps just text in the reply, or does the backend need mock handlers returning data (e.g. the fake outage status)?
9. **Idempotency key** for session creation: do we add one, and how does the frontend send it?
10. **`summary_generated` event:** when exactly should it be written (at escalation)?
11. **Unconfirmed match:** when the AI asks for confirmation (0.55 to 0.79), how does the next message express yes/no, and which reply `kind` carries the question?

---

## 18. Milestones

**Milestone 1: It starts.** Health route, errors, database migrated and seeded.

**Milestone 2: Frontend can read.** Customers, cases, timeline, handoff summary working.

**Milestone 3: Rules work without routes.** Playbook selection and escalation fully unit-tested.

**Milestone 4: The loop works.** Session, message, outcome all work end to end with fake AI.

**Milestone 5: It is trustworthy.** Metrics, concurrency tests, full test suite green, Compose demo passes, README done.

---

## 19. Final Definition of Done

- [ ] All 10 routes match the contract
- [ ] Migrations, seed, reset work from an empty database
- [ ] No failed step is ever recommended again for the same case
- [ ] Unknown never advances the playbook
- [ ] Third contact escalates before any new action
- [ ] Escalation is idempotent and the summary is complete
- [ ] Metrics match contract definitions
- [ ] Safe behavior when AI is down is tested
- [ ] Concurrency tests pass
- [ ] Backend tests run with no AI, no keys, no internet
- [ ] Compose demo passes
- [ ] README and `.env.example` are complete and contain no secrets

---

## 20. Rules to Keep Visible While Building

1. Never invent a route, field, or enum. Change the contract first.
2. The backend decides. The AI suggests.
3. A contact is a session, not a message.
4. One active action per case.
5. Failed means gone for that case, forever.
6. Every multi-step change is one transaction.
7. Never show stack traces, SQL errors, or secrets.
8. Mocked actions are always described as simulations.