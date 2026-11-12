# Development Guide

## Prerequisites
Node.js 20+, pnpm 11+, Docker Desktop (for PostgreSQL/pgvector and MinIO).

## Setup
```powershell
pnpm install
Copy-Item .env.example .env   # then fix AGENT_URL / LLM_URL ports, see configuration.md
docker compose up -d
pnpm typecheck
pnpm build
```

## Running the stack
Each service is a separate process. Per-app `package.json` scripts only define `build`, `test`, `typecheck` (the web app also has `dev`), so build first and start the compiled output, or run the TypeScript entrypoints with your preferred runner:

| Service | Entry | Port |
| --- | --- | --- |
| LLM gateway | `apps/llm/src/index.ts` | 4102 |
| Agent | `apps/agent/src/index.ts` | 4101 |
| API | `apps/api/src/index.ts` | 4100 |
| Worker | `apps/worker/src/index.ts` | – |
| Web | `pnpm --filter @agents-platform/web dev` | 5173 |

Without `DATABASE_URL` the API runs on an in-memory store (no worker/MinIO needed, but nothing is ingested).

### Local deployment

```mermaid
flowchart TB
    subgraph docker["docker compose"]
        pgc["pgvector/pgvector:pg16<br/>:5432, volume postgres_data"]
        mio["minio RELEASE.2025-09-07<br/>:9000 API, :9001 console<br/>volume minio_data"]
    end
    subgraph host["Host Node processes, started manually"]
        w5173["web :5173"]
        a4100["api :4100"]
        g4101["agent :4101"]
        l4102["llm :4102"]
        wk["worker"]
    end
    w5173 --> a4100 --> g4101 --> l4102
    a4100 --> pgc
    a4100 --> mio
    wk --> pgc
    wk --> mio
    wk --> l4102
```

## Commands
| Command | Purpose |
| --- | --- |
| `pnpm typecheck` | Typecheck all projects |
| `pnpm build` | Build packages and the Vite bundle |
| `pnpm test` | Full Vitest run (integration tests need PostgreSQL and MinIO) |
| `pnpm test:integration` | Single-threaded run for Docker-backed tests |
| `pnpm smoke:infra` | Wait for infrastructure readiness (`scripts/wait-for-infrastructure.ts`) |

Docker-free subset: see `README.md` ("Testing"). `*.integration.test.ts` files are Docker-backed; do not count their unavailability as unit failures.

## Conventions
- Strict TypeScript, ESM imports with `.js` suffixes, two-space indent, `kebab-case` files, `PascalCase` classes, `camelCase` functions.
- Keep tenant context explicit; inject dependencies at service boundaries; tests beside implementation, cross-package tests in `tests/`.
- Every tenant-owned feature needs isolation tests; service-boundary tests use injected fakes.
- Before declaring done: `pnpm typecheck`, focused tests, and `pnpm build` if build behaviour changed.

## Extending
- **New LLM provider:** implement `LlmProvider` in `apps/llm/src/providers/`, register it in `provider-registry.ts`, add the name to `LLM_PROVIDER` in `packages/config`.
- **New agent runtime:** implement `answer(AgentRequest): Promise<AgentResponse>`, register in `apps/agent/src/runtime-registry.ts`.
- **New file type:** implement `DocumentExtractor` (`supportedMimeTypes`, `extract`) and add it to the worker's extractor list.
- **Schema change:** add `NNN_name.sql` under `packages/domain/src/migrations`; migrations are forward-only and applied once.
- **New contract:** add the Zod schema to `packages/contracts` and export it from `index.ts`.

### Extension points

```mermaid
flowchart LR
    np["New LLM provider"] --> i1["implement LlmProvider"] --> r1["register in provider-registry.ts"] --> c1["add name to LLM_PROVIDER enum in config"]
    nr["New agent runtime"] --> i2["implement answer"] --> r2["register in runtime-registry.ts"]
    ne["New file type"] --> i3["implement DocumentExtractor"] --> r3["add to worker extractors list"]
    ns["Schema change"] --> i4["add NNN_name.sql migration"]
    nc["New contract"] --> i5["add Zod schema in packages/contracts and export"]
```

### Test layout

```mermaid
flowchart TD
    t["Vitest"] --> unit["Unit tests, no infrastructure"]
    t --> integ["Integration tests, need Docker"]
    unit --> u1["apps/api index.test.ts"]
    unit --> u2["apps/agent routes + basic-rag-runtime"]
    unit --> u3["apps/llm provider-registry + mock-provider"]
    unit --> u4["apps/worker chunker, worker, process-ingestion-job"]
    unit --> u5["packages/contracts, packages/config"]
    unit --> u6["domain pgvector-store, minio-object-store"]
    unit --> u7["tests/smoke/workspace"]
    integ --> i1["postgres-repositories.integration.test.ts"]
    integ --> i2["minio-object-store.integration.test.ts"]
```
