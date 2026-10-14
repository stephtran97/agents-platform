# Agents Platform prototype

This is a TypeScript end-to-end prototype for a multi-tenant Q&A SaaS. The public API, agent runtime, and LLM gateway are separate processes behind typed HTTP contracts. The first runtime is basic RAG and the first provider is deterministic mock LLM; both are replaceable through their service boundaries.

## Local setup

```powershell
pnpm install
Copy-Item .env.example .env
docker compose up -d
pnpm typecheck
pnpm build
pnpm test
```

The integration tests require Docker Desktop with PostgreSQL/pgvector and MinIO running. Without those services, unit tests still run but the two storage integration suites cannot connect.

The processes use these default ports:

- API: `4100`
- Agent: `4101`
- LLM gateway: `4102`

Run a built service with `node` from its generated `dist/` entrypoint, or use the source files directly with a TypeScript runner. The web prototype is in `apps/web`; it sends Q&A requests to the API and accepts an `x-tenant-id` header at the API boundary for tenant scoping.

## Workspace layout

- `apps/api` — public HTTP API and tenant-scoped prototype state
- `apps/agent` — agent HTTP service and runtime implementations
- `apps/llm` — provider-neutral completion/embedding gateway
- `apps/worker` — extraction, chunking, and embedding job logic
- `apps/web` — React prototype UI
- `packages/contracts` — shared Zod request/response contracts
- `packages/domain` — persistence ports, repositories, migrations, and object/vector storage adapters
- `packages/clients` — typed service clients

Never commit `.env`; use `.env.example` for local configuration.
