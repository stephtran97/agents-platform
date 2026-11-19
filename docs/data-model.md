# Data Model

Migrations live in `packages/domain/src/migrations` and run automatically at API and worker startup.

## Tables (`001_initial.sql`, `002_vector.sql`, `003_embedding_768.sql`)

| Table | Key columns | Notes |
| --- | --- | --- |
| `tenants` | `id uuid`, `name` | Root of ownership; all others cascade-delete from it |
| `users` | `tenant_id`, `email` | Unique `(tenant_id, email)`; not yet used by code |
| `knowledge_bases` | `tenant_id`, `name`, `description` | `UNIQUE (tenant_id, id)` |
| `documents` | `tenant_id`, `knowledge_base_id`, `filename`, `content_type`, `size_bytes`, `object_key`, `status` | status ∈ pending/processing/ready/failed; composite FK to knowledge base |
| `conversations` | `tenant_id`, `title` | |
| `messages` | `tenant_id`, `conversation_id`, `message jsonb`, `citations jsonb` | Ordered by `(created_at, id)` |
| `agent_configs`, `model_configs` | `tenant_id`, `name`, `config jsonb` | Reserved; not yet used by code |
| `ingestion_jobs` | `tenant_id`, `document_id`, `status`, `attempts`, `error` | status ∈ queued/processing/completed/failed; partial index on queued jobs |
| `document_chunks` | `tenant_id`, `knowledge_base_id`, `document_id`, `ordinal`, `text`, `embedding vector(768)` | `UNIQUE (tenant_id, document_id, ordinal)`; HNSW index with `vector_cosine_ops` |
| `schema_migrations` | `name`, `applied_at` | Created by `migrate()` |

**Tenant-safety pattern:** every table has `UNIQUE (tenant_id, id)` so children reference `(tenant_id, parent_id)`; a row can never point at another tenant's parent.

**Embedding dimension:** `EMBEDDING_DIMENSION = 768` in `ports/vector-store.ts` must match `vector(768)` (created as 1536 in `002_vector.sql`, resized by `003_embedding_768.sql`). `PgVectorStore` rejects other lengths or non-finite values.


### Entity-relationship diagram

```mermaid
erDiagram
    tenants ||--o{ users : has
    tenants ||--o{ knowledge_bases : owns
    tenants ||--o{ documents : owns
    tenants ||--o{ conversations : owns
    tenants ||--o{ messages : owns
    tenants ||--o{ agent_configs : owns
    tenants ||--o{ model_configs : owns
    tenants ||--o{ ingestion_jobs : owns
    tenants ||--o{ document_chunks : owns
    knowledge_bases ||--o{ documents : "tenant_id + knowledge_base_id"
    documents ||--o{ ingestion_jobs : "tenant_id + document_id"
    documents ||--o{ document_chunks : "tenant_id + kb + document_id"
    conversations ||--o{ messages : "tenant_id + conversation_id"

    tenants {
        uuid id PK
        text name
        timestamptz created_at
    }
    users {
        uuid id PK
        uuid tenant_id FK
        text email
    }
    knowledge_bases {
        uuid id PK
        uuid tenant_id FK
        text name
        text description
    }
    documents {
        uuid id PK
        uuid tenant_id FK
        uuid knowledge_base_id FK
        text filename
        text content_type
        bigint size_bytes
        text object_key
        text status
    }
    ingestion_jobs {
        uuid id PK
        uuid tenant_id FK
        uuid document_id FK
        text status
        int attempts
        text error
    }
    document_chunks {
        uuid id PK
        uuid tenant_id FK
        uuid knowledge_base_id FK
        uuid document_id FK
        int ordinal
        text text
        vector_768 embedding
    }
    conversations {
        uuid id PK
        uuid tenant_id FK
        text title
    }
    messages {
        uuid id PK
        uuid tenant_id FK
        uuid conversation_id FK
        jsonb message
        jsonb citations
    }
    agent_configs {
        uuid id PK
        uuid tenant_id FK
        text name
        jsonb config
    }
    model_configs {
        uuid id PK
        uuid tenant_id FK
        text name
        text provider
        jsonb config
    }
```

### Ports and adapters

```mermaid
classDiagram
    class TenantContext {
        +string tenantId
    }
    class DocumentRepository {
        <<interface>>
        +create(ctx, doc)
        +getById(ctx, id)
        +listByTenant(ctx)
        +updateStatus(ctx, id, status)
    }
    class ConversationRepository {
        <<interface>>
        +create(ctx, conv)
        +getById(ctx, id)
        +addMessage(ctx, msg)
        +listMessages(ctx, convId)
    }
    class JobRepository {
        <<interface>>
        +create(ctx, job)
        +claimPending(jobId)
        +claimNextPending()
        +markRunning(ctx, id)
        +markSucceeded(ctx, id)
        +markFailed(ctx, id, error)
    }
    class VectorStore {
        <<interface>>
        +upsertChunks(tenantId, kbId, chunks)
        +search(tenantId, kbIds, embedding, limit)
        +deleteDocument(tenantId, kbId, docId)
    }
    class ObjectStore {
        <<interface>>
        +put(tenantId, docId, bytes, type)
        +get(key)
        +delete(key)
    }
    DocumentRepository <|.. PostgresDocumentRepository
    ConversationRepository <|.. PostgresConversationRepository
    JobRepository <|.. PostgresJobRepository
    VectorStore <|.. PgVectorStore
    ObjectStore <|.. MinioObjectStore
    DocumentRepository ..> TenantContext
    ConversationRepository ..> TenantContext
    JobRepository ..> TenantContext
    PostgresDocumentRepository --> Pool : pg
    PostgresConversationRepository --> Pool : pg
    PostgresJobRepository --> Pool : pg
    PgVectorStore --> Pool : pg
    MinioObjectStore --> S3Client : aws-sdk
```

## Object storage

`MinioObjectStore` (AWS S3 SDK, path-style, region `us-east-1`) writes originals to `<encoded tenantId>/<encoded documentId>/<random uuid>` in the configured bucket and returns that key, which is saved in `documents.object_key`. The bucket must exist (`createBucket()` is provided for tests/setup).

## Entities (TypeScript)

`TenantOwnedEntity { id, tenantId, createdAt, updatedAt }` is extended by `KnowledgeBase`, `Document`, `IngestionJob`, `Conversation`, `ConversationMessage` in `packages/domain/src/entities.ts`.

## Search

Score = `1 − cosine_distance`; results ordered by distance then id; filtered by tenant and `knowledge_base_id = ANY(...)`.

### Ingestion job states

```mermaid
stateDiagram-v2
    [*] --> queued: API creates job
    queued --> processing: claimNextPending / claimPending, attempts + 1
    processing --> completed: markSucceeded
    processing --> failed: markFailed with CODE: message
    completed --> [*]
    failed --> [*]
    note right of failed
        No automatic retry.
        A job stuck in processing after a worker crash is not reclaimed.
    end note
```

### Document status states

```mermaid
stateDiagram-v2
    [*] --> pending: row created
    pending --> processing: extractor found, job running
    pending --> failed: unsupported type or error
    processing --> ready: chunks indexed
    processing --> failed: extraction, embedding or index error
    ready --> [*]
    failed --> [*]
```

### Chunk overlap

```mermaid
flowchart LR
    subgraph text["Extracted text, N characters"]
        direction LR
        c0["chunk 0<br/>0 .. 1200"]
        c1["chunk 1<br/>1080 .. 2280"]
        c2["chunk 2<br/>2160 .. 3360"]
        cn["..."]
    end
    c0 -- "120 overlap" --> c1 -- "120 overlap" --> c2 --> cn
    id["chunk id = UUID-shaped hash of documentId:ordinal<br/>so re-ingestion upserts the same rows"]
    c0 -.-> id
```

### Migration flow

```mermaid
flowchart TD
    s([service startup]) --> m["migrate pool"]
    m --> b["BEGIN"]
    b --> lock["pg_advisory_xact_lock<br/>serializes concurrent runners"]
    lock --> tbl["CREATE TABLE IF NOT EXISTS schema_migrations"]
    tbl --> list["list NNN_name.sql files, sorted"]
    list --> loop{"next file"}
    loop -- already applied --> loop
    loop -- new --> run["run SQL and INSERT name"] --> loop
    loop -- done --> commit["COMMIT"]
    run -. error .-> rb["ROLLBACK and rethrow"]
```
