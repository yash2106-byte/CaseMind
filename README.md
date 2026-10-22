# CaseMind Phase 1 frontend

React, TypeScript, and Vite frontend for the Case Continuity Engine. The interface uses the Phase 1 REST API as the source of truth for customers, cases, action outcomes, and escalation state.

## Start the frontend

```powershell
npm install
npm run dev
```

Open `http://localhost:6006/dashboard`.

In VS Code, you can also run **Tasks: Run Task → Start CaseMind dashboard**.

## Demo path

1. Start the backend API and seed the three demo customers.
2. Open `http://localhost:6006/support`, choose a customer, and select **Start new chat**.
3. Describe an internet-connectivity issue and use the backend-returned troubleshooting action.
4. Record the action as failed, succeeded, or unknown. Failed actions remain visible in the case timeline; the backend chooses any next step.
5. Start a new chat for the same customer to demonstrate continuity and escalation at the backend's contact limit.
6. Open the overview to review case counts and quality rates.

All displayed customer, case, action, outcome, and escalation state comes from the API. The frontend does not call the AI service directly. Demo actions that represent external ISP operations are simulations only.

## Backend API

The frontend expects the backend described in [`Docs/00_SHARED_CONTRACT.md`](./Docs/00_SHARED_CONTRACT.md) to be running at `http://localhost:3000/api/v1`. Start the backend and seed its three demo customers before using the support and case views. The browser does not call the AI service directly.

To use another API base URL, set `VITE_API_BASE_URL` in a local `.env` file, for example:

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

If the API is unavailable, the interface displays an error and does not substitute fabricated case or metric data.

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
docker build --build-arg VITE_API_BASE_URL=https://api.example.com/api/v1 -t casemind-frontend .
```

Only public API URLs belong in frontend build arguments; never put private credentials or LLM API keys in browser-visible configuration.
