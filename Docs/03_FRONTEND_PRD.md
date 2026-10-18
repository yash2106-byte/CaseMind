# Frontend PRD — Case Continuity Engine

**Stack:** React + TypeScript + Vite  
**Owner:** Frontend developer  
**Authoritative contract:** [`00_SHARED_CONTRACT.md`](00_SHARED_CONTRACT.md)

---

## 1. Objective

Build a usable demo that makes the product's main difference obvious: the bot remembers the case, displays previous actions and outcomes, avoids repeating failed steps, and produces a handoff summary when escalation is required.

The frontend is a presentation layer. It must never decide whether a case is resolved, increment contact counts, select playbook steps, or decide to escalate. Those values come from the Node.js API.

## 2. Deliverables

1. Customer selector for three seeded demo customers.
2. Chat/session flow with a **Start New Chat** button.
3. Chat transcript and message input.
4. Current troubleshooting action card with outcome controls.
5. Case status, contact count, and current step display.
6. Timeline/action history.
7. Escalation/handoff summary view.
8. Dashboard with case counts and rates.
9. Loading, empty, validation, network-error, and retry states.
10. Typed API client, MSW fixtures, independent tests, Dockerfile, `.env.example`, and README.

## 3. Suggested structure

```text
frontend/
├── src/
│   ├── api/
│   │   ├── client.ts
│   │   ├── customers.ts
│   │   ├── sessions.ts
│   │   ├── cases.ts
│   │   └── dashboard.ts
│   ├── components/
│   │   ├── CustomerSelector.tsx
│   │   ├── ChatPanel.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageComposer.tsx
│   │   ├── ActionCard.tsx
│   │   ├── CaseStatusBadge.tsx
│   │   ├── CaseTimeline.tsx
│   │   ├── HandoffSummary.tsx
│   │   └── MetricCard.tsx
│   ├── pages/
│   │   ├── SupportPage.tsx
│   │   └── DashboardPage.tsx
│   ├── types/
│   │   └── api.ts
│   ├── mocks/
│   └── tests/
├── package.json
├── Dockerfile
└── .env.example
```

The team may adjust component names, but keep the API types centralized and consistent with the Shared Contract.

## 4. Screen requirements

### 4.1 Support screen

The page must contain:
- Customer dropdown populated by `GET /api/v1/customers`.
- **Start New Chat** button.
- Current case title and status.
- Contact count (for example, “Contact 2”).
- Scrollable chat transcript.
- Message input and Send button.
- Current recommended action card when one exists.
- Three outcome controls: **Failed**, **Succeeded**, **Not sure / Unknown**.
- Link/section to view the case timeline.
- Visible loading and error states.

Do not hardcode the three customer IDs into the UI. Fetch them from the API.

### 4.2 Action card

Display:
- Step label.
- Step instructions.
- Step order (for example, “Step 2 of 6”).
- If action is mocked, a clear “Demo simulation — no real ISP action is performed” label.
- Outcome buttons only when an action is awaiting an outcome.

After an action is marked failed, the UI should show it in history with a “Failed” status and display the next action returned by the backend. The frontend must not choose that next action itself.

### 4.3 Timeline

Show chronological events oldest to newest. Each row should include a readable timestamp, event label, and useful details.

Examples:
- Case created.
- New support contact started.
- Customer message received.
- Router restart recommended.
- Customer marked router restart as failed.
- Cables and indicator lights recommended.
- Case escalated after third contact.

Use both text and visual treatment to distinguish status; do not rely on color alone.

### 4.4 Escalation screen/state

When `case.status === "escalated"`:
- Stop showing the message composer for troubleshooting on that case, or make it read-only with a clear explanation.
- Show escalation reason: third contact or playbook exhausted.
- Show handoff summary.
- Show contact count and failed steps.
- Show the case timeline.
- Display: “This is a simulated handoff for the prototype; no live human agent has been notified.”

Do not imply a human agent actually received the case.

### 4.5 Dashboard

Display these metrics from `GET /api/v1/dashboard/metrics`:
- Total cases.
- Open/in-progress cases.
- Escalated cases.
- Resolved cases.
- Repeat-contact rate.
- Repeated-recommendation rate.

The API returns rates as decimals between 0 and 1. Multiply by 100 for display. Example: `0.25` becomes `25%`. Do not multiply counts or already-formatted percentages. If there are no cases, show `0%` rather than `NaN` or an empty string.

A non-zero repeated-recommendation rate should be visually noticeable as a quality defect metric, but do not invent a threshold not defined by the contract.

## 5. User flows

### 5.1 First-time customer

1. Fetch customers and dashboard metrics.
2. User selects a customer.
3. User clicks **Start New Chat**.
4. Frontend calls `POST /api/v1/sessions`.
5. If response `case` is null, show an empty chat composer.
6. User submits a message.
7. Frontend calls `POST /api/v1/sessions/:sessionId/messages`.
8. Render backend `reply`, `case`, and `recommendedAction`.
9. If the message is off-topic, show the fixed scope response; do not create a local case.
10. If the response requests clarification, show it as an assistant message and allow the user to respond.

### 5.2 Troubleshooting and outcome

1. Display the action returned by the backend.
2. User tries it and selects Failed, Succeeded, or Unknown.
3. Call `POST /api/v1/cases/:caseId/actions/:actionId/outcome`.
4. Render the response's case and reply.
5. If a new action is returned, display it.
6. If status becomes resolved, show a success state and remove active outcome controls.
7. If status becomes escalated, switch to the escalation view.

### 5.3 Returning customer

1. User clicks **Start New Chat** for the same customer.
2. Call `POST /api/v1/sessions`.
3. Render the returned case and updated contact count.
4. If `escalationRequired === true`, show handoff summary immediately and do not offer another troubleshooting step.
5. If not escalated, resume the existing case state and show previous action history.

## 6. Polling and frontend state

- Poll active case/timeline and dashboard every 2 seconds while the page is active.
- Avoid overlapping polls: if the previous request has not completed, skip the next tick.
- Stop polling when the component unmounts or the user changes to a different customer/session.
- Ignore stale responses from previous selections.
- After a mutation, immediately use the returned canonical state and optionally refetch timeline/metrics.
- Never locally increment `contactCount`, select a playbook step, change a case status, or mark an action outcome as authoritative.
- Do not call Python endpoints from the browser.

## 7. API client behavior

Use one shared API client with:
- Base URL from `VITE_API_BASE_URL`.
- JSON request/response parsing.
- Consistent handling for non-2xx responses.
- Typed response models matching the Shared Contract.
- No secrets in frontend environment variables. A browser-visible environment variable must never contain a private LLM API key.

Handle the standard error envelope:
```json
{
  "error": {
    "code": "AI_UNAVAILABLE",
    "message": "The assistant is temporarily unavailable. Please try again.",
    "requestId": "req-example"
  }
}
```

Display a friendly message and request ID where useful. Never display server stack traces.

## 8. Independent testing plan

Use Vitest + React Testing Library + MSW. The default `npm test` must run with backend, AI service, database, API credentials, and network all absent.

Create MSW handlers and fixtures for:
- customer list success, empty, and error;
- new session with no case;
- existing unresolved case with contact count 2;
- third-contact session returning an escalated case and summary;
- in-scope first message with first action;
- off-topic response with no case;
- uncertain/clarification response;
- failed outcome returning the next action;
- succeeded outcome resolving the case;
- unknown outcome retaining the current action;
- playbook exhaustion escalation;
- dashboard with data and empty dashboard;
- API validation error, AI unavailable, and network failure.

Required tests:
1. Customers load and can be selected.
2. Send button is disabled while a message is pending.
3. Assistant reply and action card render from API response.
4. Failed action appears in timeline and returned next action is displayed.
5. Succeeded outcome shows resolved state and removes outcome controls.
6. Unknown outcome does not make the UI pretend the issue is resolved or display a different troubleshooting step; the current action remains pending clarification.
7. Third-contact response displays escalation summary and disables troubleshooting.
8. Escalation text clearly says handoff is simulated.
9. Dashboard formats decimal rates correctly.
10. Empty dashboard shows zero values without `NaN`.
11. API error displays retryable feedback and preserves draft text.
12. Polling does not overlap requests and is cleaned up.
13. Changing customer/session ignores stale responses.
14. Frontend never makes a request to the AI service.

## 9. Definition of done

- UI can run with MSW and no backend.
- All tests pass offline.
- API types match the Shared Contract.
- Case state shown on screen comes from backend responses.
- Timeline clearly shows prior failed steps.
- No failed step is presented as a new recommendation.
- Escalation and mocked external actions are described honestly.
- README documents run/test commands and the demo path.
