# Architecture

## Topology

```mermaid
flowchart LR
    user([User]) --> web["apps/web<br/>React + Vite :5173"]
    web -- "/v1/* via Vite proxy" --> api["apps/api<br/>Fastify :4100"]
    api -- "POST /v1/answer" --> agent["apps/agent<br/>Fastify :4101"]
    agent -- "completions, embeddings" --> llm["apps/llm<br/>Fastify :4102"]
    llm --> mock["MockProvider"]
    llm --> oai["OpenAI-compatible<br/>OpenAI / Azure"]
    api -- "documents, conversations, jobs" --> pg[("PostgreSQL<br/>+ pgvector :5432")]
    api -- "put original file" --> minio[("MinIO / S3 :9000")]
    worker["apps/worker<br/>polling, no HTTP"] -- "claim jobs, write chunks" --> pg
    worker -- "get original file" --> minio
    worker -- "embeddings" --> llm
    agent -. "intended: vector search" .-> pg
```

Services are separate Node processes that communicate over HTTP using typed clients (`packages/clients`) and Zod contracts (`packages/contracts`). Docker Compose only starts the infrastructure (PostgreSQL/pgvector, MinIO); the app services are run manually.

## Design principles

- **Replaceability.** Agent runtimes (`AGENT_RUNTIME`, registry in `apps/agent`) and LLM providers (`LLM_PROVIDER`, registry in `apps/llm`) are chosen behind service boundaries, so neither the web app nor the public API changes when they are swapped. Shipped: runtime `basic-rag`; providers `mock`, `openai`, `azure-openai`.
- **Ports and adapters.** `packages/domain` defines ports (`DocumentRepository`, `ConversationRepository`, `JobRepository`, `VectorStore`, `ObjectStore`) with PostgreSQL/pgvector/MinIO adapters. Apps depend on the interfaces and receive implementations by constructor injection, which keeps unit tests free of network calls.
- **Explicit tenancy.** Every repository method takes a `TenantContext { tenantId }` (or a `tenantId` argument) and every tenant-owned table carries `tenant_id` with composite foreign keys.

## Flows

### Document ingestion

1. `POST /v1/documents` (API) — body carries filename, content type, optional base64 content.
2. With persistence enabled, the API stores the bytes in MinIO (`ObjectStore.put`), inserts a `documents` row (`status = pending`) and an `ingestion_jobs` row (`status = queued`).
3. The worker polls `claimNextPending()` (`UPDATE … FOR UPDATE SKIP LOCKED`), marking the job `processing` and incrementing `attempts`.
4. `processClaimedJob`: load document → pick an extractor by MIME type (`text/plain`, `application/pdf`, DOCX) → set document `processing` → fetch object → extract text → `chunkText` (1200 chars, 120 overlap) → embed all chunks via the LLM gateway → `upsertChunks` into `document_chunks` → document `ready`, job `completed`.
5. Any error sets document `failed` and job `failed` with `CODE: message` (`DOCUMENT_UNSUPPORTED` or `INGESTION_FAILED`).


**Ingestion sequence**

```mermaid
sequenceDiagram
    autonumber
    actor C as Client
    participant API as API
    participant OS as MinIO
    participant DB as PostgreSQL
    participant W as Worker
    participant L as LLM gateway

    C->>API: POST /v1/documents (filename, contentBase64)
    API->>OS: put(tenantId, documentId, bytes)
    OS-->>API: objectKey
    API->>DB: INSERT documents (status = pending)
    API->>DB: INSERT ingestion_jobs (status = queued)
    API-->>C: 201 document

    loop every 1000 ms
        W->>DB: claimNextPending (FOR UPDATE SKIP LOCKED)
        DB-->>W: job (processing, attempts + 1) or none
    end

    W->>DB: getById(document)
    W->>DB: documents.status = processing
    W->>OS: get(objectKey)
    OS-->>W: bytes
    W->>W: extract text, chunkText 1200/120
    W->>L: POST /v1/embeddings (all chunks)
    L-->>W: embeddings (1536-dim)
    W->>DB: upsert document_chunks
    W->>DB: documents.status = ready
    W->>DB: job = completed
```

### Question answering

1. Web: `POST /v1/conversations`, then `POST /v1/conversations/:id/messages` with `{ message, knowledgeBaseIds }`, header `x-tenant-id`.
2. API verifies the conversation belongs to the tenant, validates with `conversationRequestSchema`, calls the agent (`POST /v1/answer`).
3. `BasicRagRuntime`: retrieve top 5 chunks → if none, return a fixed "could not find relevant information" answer → otherwise build a prompt `question + Context:` with `[chunkId] content` lines → LLM completion → return answer, citations (one per chunk), usage, `traceId`.
4. `VectorRetriever` (the intended retrieval adapter) embeds the query via the LLM gateway and calls `PgVectorStore.search` (cosine distance, tenant + knowledge-base filtered). **See [known-gaps.md](known-gaps.md): the agent entrypoint currently wires a stub that returns no chunks.**


**Question answering sequence**

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant Web as Web
    participant API as API
    participant A as Agent basic-rag
    participant R as Retriever
    participant L as LLM gateway

    U->>Web: type question
    Web->>API: POST /v1/conversations (x-tenant-id)
    API-->>Web: 201 id
    Web->>API: POST /v1/conversations/:id/messages
    API->>API: verify conversation belongs to tenant
    API->>API: validate conversationRequestSchema
    API->>A: POST /v1/answer
    A->>R: search(tenantId, knowledgeBaseIds, question, limit 5)
    R-->>A: chunks
    alt no chunks
        A-->>API: fixed "could not find relevant information"
    else chunks found
        A->>L: POST /v1/completions (question + Context)
        L-->>A: message + usage
        A-->>API: answer + citations + usage + traceId
    end
    API-->>Web: 200 answer
    Web-->>U: answer and citations
```

## Tenant isolation

- API resolves tenant from the `x-tenant-id` header (fallback `TENANT_ID` env, then `local`). This is a **development selector, not authentication**.
- All repository SQL filters on `tenant_id`; cross-tenant references are prevented by composite FKs such as `(tenant_id, knowledge_base_id) → knowledge_bases(tenant_id, id)`.
- `PgVectorStore.upsertChunks` inserts via `SELECT … FROM documents WHERE tenant_id/knowledge_base_id/id`, so a chunk cannot be written outside its owning document's tenant and knowledge base.
- Vector search always includes `tenant_id = $1 AND knowledge_base_id = ANY($2)`.

### Isolation layers

```mermaid
flowchart TD
    req["Request with x-tenant-id<br/>dev selector, not authentication"] --> res["API resolves tenantId<br/>header, then TENANT_ID, then local"]
    res --> ctx["TenantContext passed to every repository call"]
    ctx --> sql["SQL WHERE tenant_id = $1 on all reads and writes"]
    sql --> fk["Composite FKs tenant_id + parent_id<br/>block cross-tenant references"]
    ctx --> vec["Vector upsert via SELECT FROM documents<br/>scoped to tenant + knowledge base"]
    ctx --> srch["Vector search<br/>tenant_id AND knowledge_base_id = ANY"]
    ctx --> obj["Object key prefix<br/>tenantId/documentId/uuid"]
```
