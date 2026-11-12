# Configuration

Copy `.env.example` to `.env` (never commit it). Apps read `process.env` directly; the `@agents-platform/config` package provides a validated `loadConfig()` that the app entrypoints do not currently call.

| Variable | Used by | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | api, worker | worker: `postgres://agents:agents@localhost:5432/agents` | API uses the persistent store only when set |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | api, worker | `http://localhost:9000` / `agents-documents` / `minioadmin` / `minioadmin` | |
| `AGENT_URL` | api | `http://localhost:4101` | |
| `LLM_URL` | agent, worker | `http://localhost:4102` | |
| `TENANT_ID` | api | `local` | Fallback when no `x-tenant-id` header |
| `AGENT_RUNTIME` | agent | `basic-rag` | Registry name |
| `LLM_PROVIDER` | llm | `mock` | `mock`, `openai`, `azure-openai` |
| `OPENAI_API_KEY` / `AZURE_OPENAI_API_KEY` | llm | – | Required for the respective provider |
| `AZURE_OPENAI_ENDPOINT` | config pkg | – | Required by `loadConfig` for azure; the gateway itself uses `LLM_BASE_URL` |
| `LLM_BASE_URL` | llm | `https://api.openai.com/v1` | OpenAI-compatible base URL |
| `PORT` | api, agent, llm | 4100 / 4101 / 4102 | |
| `POSTGRES_*`, `MINIO_ROOT_*` | docker-compose | `agents` / `minioadmin` | Infrastructure credentials |

Compose services: `pgvector/pgvector:pg16` on `5432`, MinIO on `9000` (API) and `9001` (console), each with a health check and a named volume.

Note: `.env.example` sets `AGENT_URL=http://localhost:3001` and `LLM_URL=http://localhost:3002`, which differ from the code defaults (4101/4102). Update them to the real ports when using the file.

### Configuration flow

```mermaid
flowchart TD
    envfile[".env from .env.example"] --> compose["docker compose<br/>POSTGRES_*, MINIO_ROOT_*"]
    envfile --> procs["Node processes read process.env"]
    procs --> apiE["api: DATABASE_URL, S3_*, AGENT_URL, TENANT_ID, PORT"]
    procs --> agentE["agent: AGENT_RUNTIME, LLM_URL, PORT"]
    procs --> llmE["llm: LLM_PROVIDER, OPENAI_API_KEY, AZURE_OPENAI_API_KEY, LLM_BASE_URL, PORT"]
    procs --> workE["worker: DATABASE_URL, S3_*, LLM_URL"]
    cfg["packages/config loadConfig<br/>Zod validation"] -. "not called by entrypoints" .-> procs
    apiE --> sw{"DATABASE_URL set?"}
    sw -- yes --> persistent["persistent store<br/>Postgres + MinIO"]
    sw -- no --> memory["in-memory store"]
```

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
