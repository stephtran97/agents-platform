# Agents Platform prototype

This repository contains a TypeScript end-to-end prototype for a multi-tenant SaaS Q&A platform. The public API, agent service, LLM gateway, ingestion worker, and React web client are separate workspace applications connected by shared Zod contracts and typed HTTP clients.

## Architecture

- `apps/api` — public API, tenant context, document/conversation orchestration, and persistence composition.
- `apps/agent` — replaceable agent runtime boundary, retrieval adapter, grounded RAG runtime, and citations.
- `apps/llm` — provider-neutral completion/embedding gateway with mock and OpenAI-compatible providers.
- `apps/worker` — polling ingestion worker with TXT/PDF/DOCX extraction, deterministic chunking, embeddings, and pgvector upserts.
- `apps/web` — React/Vite Q&A prototype.
- `packages/contracts` — shared request/response schemas and inferred types.
- `packages/domain` — tenant-aware persistence ports, PostgreSQL repositories, pgvector adapter, MinIO adapter, and migrations.
- `packages/clients` — typed API clients for agent and LLM services.

The initial runtime/provider pair is `basic-rag` plus `mock`. Runtime and provider selection are intentionally behind service boundaries so new agent methods and LLM providers can be added without changing the public API.

## Local setup

Prerequisites: Node.js 20+, pnpm 11+, and Docker Desktop for PostgreSQL/pgvector and MinIO.

```powershell
pnpm install
Copy-Item .env.example .env
docker compose up -d
pnpm typecheck
pnpm build
```

`docker compose up -d` starts only PostgreSQL and MinIO for host-process development. To run the whole stack with each app in its own container (postgres, minio, minio-init bucket creation, llm, agent, api, worker, web), use:

```powershell
docker compose up -d --build --wait
```

The web app is then served at http://localhost:5173 (nginx proxies `/v1` to the `api` container). Inside Compose, services reach each other by service name; `.env` values such as `LLM_PROVIDER`, `OPENAI_API_KEY`, `AGENT_RUNTIME`, and `TENANT_ID` are passed through. All app images are built from the root `Dockerfile` (`--target api|agent|llm|worker|web`).

For host-process development, run the apps as separate Node processes. Default service ports are:

- API: `4100`
- Agent: `4101`
- LLM gateway: `4102`
- Web dev server: `5173`

The API uses repository-backed persistence when `DATABASE_URL` is set; otherwise it falls back to an in-memory development store. The worker runs migrations on startup and consumes queued ingestion jobs. The web dev server proxies `/v1` requests to the API.

To run the web client:

```powershell
pnpm --filter @agents-platform/web dev
```

For local development, the API accepts `x-tenant-id` as a development tenant selector. This is not production authentication; replace it with an authenticated identity provider before exposing the service publicly.

## Testing

Run the non-integration suite without Docker:

```powershell
pnpm typecheck
pnpm exec vitest run tests/smoke apps/api/src/index.test.ts apps/agent/src apps/llm/src apps/worker/src packages/contracts/src packages/config/src packages/domain/src/repositories/pgvector-store.test.ts packages/domain/src/storage/minio-object-store.test.ts --pool=threads --maxWorkers=1 --minWorkers=1
pnpm --filter @agents-platform/web build
```

The PostgreSQL and MinIO integration tests require Docker Desktop and running services. They are intentionally not included in the non-integration verification command above.

### Integration, evaluation, and end-to-end tests

`tests/evaluation/basic-rag.evaluation.test.ts` runs `basic-rag` over the mock provider against `tests/evaluation/fixtures/handbook.txt` and needs no infrastructure. `tests/integration/document-to-answer.test.ts` drives the full upload → ingestion → question → citation flow over HTTP against the running Compose stack (`API_URL`, default `http://localhost:4100`, with `LLM_PROVIDER=mock`); it skips its tests when the API is unreachable.

```powershell
docker compose up -d --build --wait
pnpm exec vitest run tests/evaluation tests/integration
pnpm test:e2e   # Playwright, API stubbed
```

In Compose only the web (`5173`) and API (`4100`) ports are published; the agent and LLM services are reachable only on the internal network. To switch behaviour, set `AGENT_RUNTIME` / `LLM_PROVIDER` in `.env` and recreate the containers.

Never commit `.env`, credentials, or provider API keys. Use `.env.example` as the sanitized configuration reference.
