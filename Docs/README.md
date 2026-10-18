# Case Continuity Engine — Detailed PRD Bundle

**Version:** 1.1  
**Date:** 18 October 2026  
**Status:** Idea-stage implementation specification  
**Audience:** Backend developer, AI engineer, frontend developer, mentor/reviewer

## Read these documents in this order

1. [`00_SHARED_CONTRACT.md`](00_SHARED_CONTRACT.md) — authoritative product behavior, schemas, APIs, enums, database contract, and acceptance tests.
2. [`01_BACKEND_PRD.md`](01_BACKEND_PRD.md) — Node.js + Express implementation.
3. [`02_AI_PRD.md`](02_AI_PRD.md) — Python + FastAPI AI service.
4. [`03_FRONTEND_PRD.md`](03_FRONTEND_PRD.md) — React + TypeScript + Vite interface.

## Source-of-truth rule

The **Shared Contract wins** if another document differs. Do not independently rename fields, change enum values, add alternative endpoints, or change business rules in one component. If a contract change is needed, update the Shared Contract first, then update every affected PRD and test fixture in the same change.

## Decisions already agreed

- Backend: Node.js + Express.js.
- AI service: Python + FastAPI, separate container.
- Frontend: React + TypeScript + Vite.
- Database: PostgreSQL with pgvector available.
- Local orchestration: Docker Compose.
- LLM: free-tier provider if available; default automated tests must not need an API key or network.
- Phase 1 domain: internet-connectivity complaints only; English only.
- Demo: three seeded customers; no authentication.
- A **contact** is a new chat session, not a message.
- Escalate when `contact_count >= 3` or the troubleshooting playbook is exhausted.
- Never recommend a step again after that step is marked `failed` for the same case.
- Frontend polls for updates every 2 seconds; no websockets.
- Each component must have an independent test suite that runs before integration.

## Suggested repository layout

```text
case-continuity-engine/
├── docker-compose.yml
├── .env.example
├── README.md
├── contract/
│   └── 00_SHARED_CONTRACT.md
├── backend/
│   ├── src/
│   ├── migrations/
│   ├── seeds/
│   ├── tests/
│   ├── Dockerfile
│   └── package.json
├── ai-service/
│   ├── app/
│   ├── tests/
│   ├── fixtures/
│   ├── Dockerfile
│   └── requirements.txt
└── frontend/
    ├── src/
    ├── tests/
    ├── mocks/
    ├── Dockerfile
    └── package.json
```

The team may choose a different internal folder structure, but service boundaries, routes, schemas, enums, and behavior must remain as defined by the Shared Contract.

## Delivery sequence

1. Review the Shared Contract together and agree on the request/response examples.
2. Create database migrations and seed/reset scripts.
3. Implement backend routes using a mocked AI client.
4. Implement the AI endpoints with a deterministic fake provider.
5. Implement frontend screens against MSW fixtures copied from the contract.
6. Run each component's independent tests.
7. Run the database-backed tests.
8. Start the complete stack with Docker Compose and run the demo scenario.
