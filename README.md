# CaseMind Phase 1 frontend

React, TypeScript, and Vite frontend for the Case Continuity Engine. The interface uses the Phase 1 REST API as the source of truth for customers, cases, action outcomes, and escalation state.

## Start the frontend

```powershell
npm install
npm run dev
```

Open `http://localhost:6006/dashboard`.

In VS Code, you can also run **Tasks: Run Task → Start CaseMind dashboard**.

## Backend API

The frontend expects the backend described in [`Docs/00_SHARED_CONTRACT.md`](./Docs/00_SHARED_CONTRACT.md) to be running at `http://localhost:3000/api/v1`. Start the backend and seed its three demo customers before using the support and case views. The browser does not call the AI service directly.

To use another API base URL, set `VITE_API_BASE_URL` in a local `.env` file, for example:

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

If the API is unavailable, the interface displays an error and does not substitute fabricated case or metric data.

## Validation

```powershell
npm run build
```
