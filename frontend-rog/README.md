# CaseMind Phase 1 frontend

React, TypeScript, and Vite frontend for the Case Continuity Engine. The interface uses the Phase 1 REST API as the source of truth for customers, cases, action outcomes, and escalation state.

## Start the frontend

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:6006/dashboard`.

In VS Code, you can also run **Tasks: Run Task → Start CaseMind dashboard**.

The example environment enables the interactive seeded demo (`VITE_DEMO_MODE=true`), so no backend is needed for the walkthrough. Demo state is held in the frontend mock service and is never written to a database.

## Demo path

1. Start the backend API and seed the three demo customers.
2. Open `http://localhost:6006/support`, choose a customer, and select **Start new chat**.
3. Describe an internet-connectivity issue and use the backend-returned troubleshooting action.
4. Record the action as failed, succeeded, or unknown. Failed actions remain visible in the case timeline; the backend chooses any next step.
5. Start a new chat for the same customer to demonstrate continuity and escalation at the backend's contact limit.
6. Open the overview to review case counts and quality rates.

All displayed customer, case, action, outcome, and escalation state comes from the API. The frontend does not call the AI service directly. Demo actions that represent external ISP operations are simulations only.

## Backend API

To use the real backend, set `VITE_DEMO_MODE=false` in `.env`. The frontend then uses the API described in [`Docs/00_SHARED_CONTRACT.md`](../Docs/00_SHARED_CONTRACT.md), defaulting to `http://localhost:3000/api/v1`. Start the backend and seed its three demo customers before using support and case views. The browser does not call the AI service directly.

To use another API base URL, set `VITE_API_BASE_URL` in `.env`, for example:

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

If the API is unavailable, the interface displays an error and does not substitute fabricated case or metric data.

Vite loads `.env` when the development server starts. Restart `npm run dev` after changing demo mode or the API URL.

## Seeded demo walkthrough

- **Aarav Sharma:** Open Support to see the first router restart recommendation. Mark it failed to see the cable check appear while the failed step stays in history.
- **Priya Das:** Select Priya to see the previous failed router restart and current cable check. Starting another chat increments her contact count; a third contact escalates before another step.
- **Rohan Mehta:** Select Rohan to inspect the third-contact escalation, failed action history, and simulated handoff. There is no active troubleshooting action.
- Send an unrelated message in an active conversation to see the internet-support scope response. Responses in demo mode are deterministic; no live AI classification or ISP operation is performed.
- Use **Reset demo** on the Overview page and confirm to restore the original customers, cases, action ledger, and activity.

## Offline tests and build

```powershell
npm test
npm run build
```

The test suite uses MSW fixtures and runs without the backend, AI service, database, API credentials, or network access.

## Container

```powershell
docker build -t casemind-frontend .
docker run --rm -p 6006:80 casemind-frontend
```

The API base URL is compiled into the frontend. Override it for a deployed API with:

```powershell
docker build --build-arg VITE_DEMO_MODE=true --build-arg VITE_API_BASE_URL=https://api.example.com/api/v1 -t casemind-frontend .
```

Only public API URLs belong in frontend build arguments; never put private credentials or LLM API keys in browser-visible configuration.
