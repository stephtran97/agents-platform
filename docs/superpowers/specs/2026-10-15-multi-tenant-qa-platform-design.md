# Multi-Tenant SaaS Multi-Agent Q&A Platform Design

**Date:** 2026-10-15  
**Status:** Design approved in conversation; awaiting written-spec review  
**Initial target:** Technical prototype, Phase 1 vertical slice

## Intent and success criteria

Build a TypeScript end-to-end prototype for document-grounded Q&A. The first slice is single-tenant in user experience, but tenant ownership is present in the data model and service contracts so the system can evolve into a multi-tenant SaaS product.

The primary architectural constraint is replaceability:

- Agent runtimes must be swappable without changing the web app or public API.
- LLM providers must be swappable without changing the agent runtime contract.
- The same evaluation fixtures and mock provider must work across implementations.

The prototype succeeds when a user can upload supported documents, wait for ingestion, ask questions, receive grounded answers with citations, and run the flow locally with replaceable agent and LLM implementations.

## Scope

### Included

- React web application for document upload, ingestion status, conversations, and cited answers.
- TypeScript API service for application orchestration and persistence.
- Independent agent service with a basic RAG runtime.
- Independent LLM gateway service with OpenAI, Azure OpenAI, and mock-provider adapters.
- Document ingestion worker for extraction, chunking, embeddings, and indexing.
- PostgreSQL for application data and pgvector for the initial vector store.
- S3-compatible object storage, such as MinIO, for original documents.
- Docker Compose local development environment.
- Structured logging, trace IDs, normalized errors, retries, and contract/integration tests.

### Deferred

- Multiple production tenants in the UI.
- Advanced roles and permissions.
- SSO/OAuth integrations.
- Billing, quotas, and usage charging.
- Autoscaling and Kubernetes deployment.
- Production secrets management and distributed tracing infrastructure.
- Advanced agent planning, long-running workflows, and human approval steps.

Deferred features may influence extension points, but must not add implementation complexity to the first vertical slice unless required by a boundary.

## Architecture

Use a TypeScript monorepo with independently runnable applications:

```text
apps/
  web/          React chat and document UI
  api/          public HTTP API and business orchestration
  agent/        agent-runtime service
  llm/          provider-neutral LLM gateway
  worker/       document ingestion and embedding worker

packages/
  contracts/    shared request/response schemas
  domain/       tenant, document, conversation, and knowledge models
  clients/      typed service clients
  config/       validated environment configuration
  observability/ logging and tracing helpers
```

Infrastructure:

- PostgreSQL stores tenants, users, knowledge bases, documents, conversations, messages, agent configuration, model configuration, and job state.
- pgvector stores document chunk embeddings initially, behind a vector-store interface.
- S3-compatible object storage stores original files.
- Redis is optional and should be added only for job state, caching, or rate limiting where the prototype needs it.
- Docker Compose runs local dependencies and services.

Responsibilities:

- **Web:** presentation and user interaction. It never calls an LLM directly.
- **API:** development identity/authentication placeholder, tenant context, document and conversation APIs, persistence, and coordination.
- **Agent:** retrieval and answer orchestration. It receives a provider-neutral request and returns an answer, citations, usage, and trace metadata.
- **LLM:** provider credentials, provider selection, normalized completion and embedding operations, retries, timeouts, usage, and provider-specific error translation.
- **Worker:** file parsing, text extraction, chunking, embedding requests, vector writes, and ingestion status updates.

Service communication is HTTP-based initially. Shared schemas are versioned and generated from the contracts package. Framework-specific types must not leak into shared contracts.

## Data model

Every tenant-owned record includes `tenantId`, even though the first user experience exposes one tenant. The initial entities are:

- `Tenant`
- `User`
- `KnowledgeBase`
- `Document`
- `DocumentChunk`
- `Conversation`
- `Message`
- `AgentConfig`
- `ModelConfig`
- `IngestionJob`

The API derives tenant context from the authenticated session or development identity. Services must not trust an arbitrary tenant ID supplied by a caller.

## Data flows

### Document ingestion

```text
Web -> API: upload document
API -> Object Storage: store original file
API -> Database: create document and ingestion job
Worker -> Object Storage: read file
Worker: extract text and create chunks
Worker -> LLM: create embeddings
Worker -> Vector Store: persist chunks and vectors
Worker -> Database: mark document ready or failed
```

The worker must make job retries safe and idempotent. Unsupported formats and processing failures remain visible on the document and ingestion job rather than silently disappearing.

### Question answering

```text
Web -> API: ask question
API: validate tenant and conversation
API -> Agent: question, history, tenant, knowledge-base scope
Agent -> Vector Store: retrieve relevant chunks
Agent -> LLM: prompt plus retrieved context
Agent -> API: answer, citations, usage, trace ID
API -> Database: persist messages and metadata
API -> Web: response
```

The first implementation may return complete responses. The API and service contracts must support streaming later without requiring a frontend or domain-model rewrite.

## Service contracts

The agent service exposes a provider-neutral request and response. The conceptual request is:

```ts
type AgentRequest = {
  tenantId: string;
  knowledgeBaseIds: string[];
  conversationId: string;
  messages: Message[];
  question: string;
  options?: Record<string, unknown>;
};
```

The response includes the answer, citations, tool-call metadata, usage, and trace ID:

```ts
type AgentResponse = {
  answer: string;
  citations: Citation[];
  toolCalls: ToolCall[];
  usage?: Usage;
  traceId: string;
};
```

The agent service uses an internal runtime interface:

```ts
interface AgentRuntime {
  answer(request: AgentRequest): Promise<AgentResponse>;
  stream?(request: AgentRequest): AsyncIterable<AgentEvent>;
}
```

The initial runtime is `basic-rag`, selected through configuration such as `AGENT_RUNTIME=basic-rag`. Future custom or framework-based runtimes implement the same interface.

The LLM service exposes normalized operations for chat completion, streaming chat completion, embeddings, and model capability discovery:

```ts
interface LlmProvider {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream?(request: CompletionRequest): AsyncIterable<CompletionEvent>;
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  listModels(): Promise<ModelDescriptor[]>;
}
```

Initial adapters are OpenAI, Azure OpenAI, and a deterministic mock provider. The agent only depends on the normalized LLM contract.

## Error handling and observability

- Every request receives a `traceId` propagated across service calls and worker jobs.
- Services emit structured JSON logs.
- API calls to agent and LLM services have explicit timeouts.
- Boundary errors use stable codes such as `DOCUMENT_UNSUPPORTED`, `INGESTION_FAILED`, `MODEL_UNAVAILABLE`, and `RETRIEVAL_FAILED`.
- LLM provider failures are translated by the LLM service; provider-specific errors do not escape into domain contracts.
- Ingestion jobs are retryable and idempotent.
- The API records failed ingestion and answer operations with enough metadata for local debugging.

## Testing strategy

- Unit tests cover chunking, retrieval ranking, prompt construction, provider adapters, error translation, and agent runtimes.
- Contract tests verify API-to-agent and agent-to-LLM compatibility.
- Integration tests use PostgreSQL/pgvector, object storage, and the mock LLM provider.
- One end-to-end test covers upload, ingestion, question answering, and citation output.
- Evaluation fixtures use a small fixed document set to compare agent runtimes and LLM providers.

The mock provider is required for deterministic tests, local development without credentials, and repeatable runtime comparisons.

## Initial delivery slices

1. Establish the monorepo, shared contracts, configuration, local infrastructure, and health checks.
2. Implement document upload, object storage, metadata, and ingestion status.
3. Implement extraction, chunking, mock embeddings, pgvector indexing, and retrieval.
4. Implement the LLM gateway and mock provider, then add a real provider adapter.
5. Implement the basic RAG agent and API conversation flow.
6. Implement the web upload/chat experience and citations.
7. Add contract, integration, end-to-end, and evaluation tests.

This order keeps each service independently testable while producing a working vertical slice as early as possible.

## Decisions and constraints

- TypeScript is used end-to-end for the prototype.
- HTTP is the initial inter-service protocol; queues and event-driven decomposition are deferred.
- PostgreSQL/pgvector is the first vector implementation; vector access is abstracted for later alternatives.
- The API is the only public application boundary.
- The agent and LLM services are separate processes from the beginning to preserve the requested experimentation boundaries.
- Production multi-tenancy is a future phase, but tenant identity and ownership are modeled from the first migration.
