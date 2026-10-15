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

The current Compose file starts the infrastructure dependencies only. The application services are run as separate Node processes during this prototype phase. Default service ports are:

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

Never commit `.env`, credentials, or provider API keys. Use `.env.example` as the sanitized configuration reference.
