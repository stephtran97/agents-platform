# Multi-Tenant SaaS Multi-Agent Q&A Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript prototype that ingests tenant-owned documents and answers questions with citations through replaceable agent-runtime and LLM-provider services.

**Architecture:** Use a pnpm TypeScript monorepo with React/Vite web UI, Fastify API/agent/LLM HTTP services, a polling ingestion worker, shared Zod contracts, PostgreSQL with pgvector, and MinIO object storage. The API is the public boundary; the agent service owns RAG orchestration; the LLM service owns provider adapters and credentials.

**Tech Stack:** TypeScript, pnpm workspaces, Node.js, Fastify, Zod, React, Vite, Vitest, PostgreSQL 16 + pgvector, MinIO, Docker Compose, AWS S3 SDK, OpenAI SDK, Azure OpenAI SDK.

**Spec:** [2026-10-15-multi-tenant-qa-platform-design.md](../specs/2026-10-15-multi-tenant-qa-platform-design.md)

## Global Constraints

- TypeScript is used end-to-end for the prototype.
- HTTP is the initial inter-service protocol; queues and event-driven decomposition are deferred.
- PostgreSQL/pgvector is the first vector implementation; vector access is abstracted for later alternatives.
- The API is the only public application boundary.
- The agent and LLM services are separate processes from the beginning.
- Every tenant-owned record includes `tenantId`.
- The initial embedding dimension is `1536` for both the mock provider and the first real provider configuration.
- The first implementation may return complete responses, but contracts must support streaming later.
- The mock LLM provider is required for deterministic tests and local development without credentials.
- Production multi-tenancy UI, advanced RBAC, SSO/OAuth, billing, autoscaling, Kubernetes, and production secrets management are deferred.

## Review Focus

- **Tenant spoofing:** a caller-supplied tenant ID must not override the authenticated/development tenant context; test this in the API authorization tests.
- **Unsupported and malformed documents:** ingestion must produce a visible failed job with a stable `DOCUMENT_UNSUPPORTED` or `INGESTION_FAILED` code; test this in worker tests.
- **Provider failure and timeout:** the LLM gateway must normalize provider failures to stable errors and enforce request timeouts; test this in adapter/gateway tests.
- **No relevant retrieval context:** the agent must return a grounded no-answer response with no fabricated citation; test this in runtime tests.
- **Retry/idempotency:** reprocessing the same ingestion job must not duplicate chunks or vectors; test this in worker/integration tests.

---

### Task 1: Initialize the monorepo and local development environment

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `apps/api/package.json`
- Create: `apps/agent/package.json`
- Create: `apps/llm/package.json`
- Create: `apps/worker/package.json`
- Create: `apps/web/package.json`
- Create: `packages/contracts/package.json`
- Create: `packages/domain/package.json`
- Create: `packages/clients/package.json`
- Create: `packages/config/package.json`
- Create: `packages/observability/package.json`
- Test: `tests/smoke/workspace.test.ts`

**Interfaces:**
- Produces workspace scripts: `dev`, `build`, `test`, `typecheck`, `test:integration`.
- Produces local services `postgres` and `minio` with health checks and named volumes.
- Produces environment names used by later tasks: `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `AGENT_URL`, `LLM_URL`, `TENANT_ID`, `LLM_PROVIDER`, and `AGENT_RUNTIME`.

- [ ] **Step 1: Write the failing workspace smoke test**

  Assert the workspace package manifest exposes `build`, `test`, and `typecheck`, and that each app/package directory has a `package.json` with a `typecheck` script.

- [ ] **Step 2: Run the smoke test to verify it fails**

  Run: `pnpm exec vitest run tests/smoke/workspace.test.ts`

  Expected: FAIL because the workspace files do not exist.

- [ ] **Step 3: Implement the workspace skeleton**

  Add pnpm workspace metadata, shared TypeScript compiler settings, package scripts, `.env.example`, and Docker Compose services. Keep application source files empty until their owning tasks.

- [ ] **Step 4: Add local infrastructure health checks**

  Configure PostgreSQL with pgvector and MinIO with persistent named volumes. Add a smoke script that waits for both health checks.

- [ ] **Step 5: Run the smoke test and typecheck**

  Run: `pnpm exec vitest run tests/smoke/workspace.test.ts && pnpm typecheck`

  Expected: PASS with all workspace packages discoverable.

- [ ] **Step 6: Commit**

  `git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .env.example docker-compose.yml apps packages tests/smoke/workspace.test.ts && git commit -m "chore: initialize TypeScript monorepo"`

### Task 2: Define shared contracts, domain types, and configuration

**Files:**
- Create: `packages/contracts/src/common.ts`
- Create: `packages/contracts/src/documents.ts`
- Create: `packages/contracts/src/conversations.ts`
- Create: `packages/contracts/src/agent.ts`
- Create: `packages/contracts/src/llm.ts`
- Create: `packages/contracts/src/errors.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/domain/src/entities.ts`
- Create: `packages/domain/src/tenant-context.ts`
- Create: `packages/domain/src/index.ts`
- Create: `packages/config/src/env.ts`
- Create: `packages/config/src/index.ts`
- Test: `packages/contracts/src/contracts.test.ts`
- Test: `packages/config/src/env.test.ts`

**Interfaces:**
- Produces `AgentRequest`, `AgentResponse`, `Citation`, `Message`, `CompletionRequest`, `CompletionResponse`, `EmbeddingRequest`, `EmbeddingResponse`, `ModelDescriptor`, `DocumentStatus`, `IngestionJobStatus`, and `ErrorCode`.
- Produces Zod schemas and inferred TypeScript types for every HTTP boundary.
- Produces `loadConfig(env: NodeJS.ProcessEnv): AppConfig` and `TenantContext`.

- [ ] **Step 1: Write contract tests**

  Test valid parsing for upload metadata, agent requests/responses, LLM completion/embedding requests, citations, stable error codes, and rejection of missing `tenantId` on tenant-owned requests.

- [ ] **Step 2: Run contract tests to verify they fail**

  Run: `pnpm --filter @agents-platform/contracts test`

  Expected: FAIL because schemas and exports do not exist.

- [ ] **Step 3: Implement the schemas and types**

  Use Zod as the runtime authority. Define `AgentRuntime` and `LlmProvider` interfaces in the service packages later; this package contains only transport-safe request/response shapes and domain enums.

- [ ] **Step 4: Implement environment validation**

  `loadConfig` must require service URLs and database/object-storage settings, apply local defaults for `TENANT_ID`, `AGENT_RUNTIME=basic-rag`, and `LLM_PROVIDER=mock`, and reject invalid URLs or empty secrets where a real provider is selected.

- [ ] **Step 5: Run contract and config tests**

  Run: `pnpm --filter @agents-platform/contracts test && pnpm --filter @agents-platform/config test && pnpm typecheck`

  Expected: PASS.

- [ ] **Step 6: Commit**

  `git add packages/contracts packages/domain packages/config && git commit -m "feat: add shared contracts and configuration"`

### Task 3: Create database migrations and storage ports

**Files:**
- Create: `packages/domain/src/ports/document-repository.ts`
- Create: `packages/domain/src/ports/conversation-repository.ts`
- Create: `packages/domain/src/ports/vector-store.ts`
- Create: `packages/domain/src/ports/object-store.ts`
- Create: `packages/domain/src/ports/job-repository.ts`
- Create: `packages/domain/src/ports/index.ts`
- Create: `packages/domain/src/migrations/001_initial.sql`
- Create: `packages/domain/src/migrations/002_vector.sql`
- Create: `packages/domain/src/db.ts`
- Create: `packages/domain/src/repositories/postgres-document-repository.ts`
- Create: `packages/domain/src/repositories/postgres-conversation-repository.ts`
- Create: `packages/domain/src/repositories/postgres-job-repository.ts`
- Create: `packages/domain/src/repositories/pgvector-store.ts`
- Create: `packages/domain/src/storage/minio-object-store.ts`
- Test: `packages/domain/src/repositories/postgres-repositories.integration.test.ts`
- Test: `packages/domain/src/storage/minio-object-store.integration.test.ts`

**Interfaces:**
- `DocumentRepository.create`, `getById`, `listByTenant`, and `updateStatus` always require `TenantContext`.
- `JobRepository.claimNextPending`, `markRunning`, `markSucceeded`, and `markFailed` are idempotent by `jobId`.
- `VectorStore.upsertChunks`, `search`, and `deleteDocument` require `tenantId` and knowledge-base scope.
- `ObjectStore.put`, `get`, and `delete` use opaque object keys and never expose provider-specific types.

- [ ] **Step 1: Write integration tests against PostgreSQL and MinIO**

  Assert tenant-scoped reads cannot return another tenant’s document, vector search filters by `tenantId` and `knowledgeBaseId`, object upload/download round-trips, and claiming a job twice returns it only once.

- [ ] **Step 2: Run integration tests to verify they fail**

  Run: `pnpm test:integration -- packages/domain/src/repositories/postgres-repositories.integration.test.ts packages/domain/src/storage/minio-object-store.integration.test.ts`

  Expected: FAIL because migrations and adapters do not exist.

- [ ] **Step 3: Implement migrations and ports**

  Create tables for tenants, users, knowledge bases, documents, document chunks, conversations, messages, agent/model config, and ingestion jobs. Add tenant-aware indexes and a pgvector column with a documented embedding dimension constant.

- [ ] **Step 4: Implement repository and storage adapters**

  Use parameterized SQL. Enforce tenant filters in repository methods rather than relying on callers. Use MinIO through the S3-compatible client and make object keys include tenant and document identifiers.

- [ ] **Step 5: Run integration tests and typecheck**

  Run: `docker compose up -d postgres minio; pnpm test:integration -- packages/domain/src/repositories/postgres-repositories.integration.test.ts packages/domain/src/storage/minio-object-store.integration.test.ts; pnpm typecheck`

  Expected: PASS with no cross-tenant rows or vectors observable.

- [ ] **Step 6: Commit**

  `git add packages/domain && git commit -m "feat: add tenant-scoped persistence ports"`

### Task 4: Implement document extraction, chunking, and the ingestion worker

**Files:**
- Create: `apps/worker/src/extractors/extractor.ts`
- Create: `apps/worker/src/extractors/plain-text-extractor.ts`
- Create: `apps/worker/src/extractors/pdf-extractor.ts`
- Create: `apps/worker/src/extractors/docx-extractor.ts`
- Create: `apps/worker/src/chunking/chunker.ts`
- Create: `apps/worker/src/embedding/embedding-client.ts`
- Create: `apps/worker/src/jobs/process-ingestion-job.ts`
- Create: `apps/worker/src/worker.ts`
- Create: `apps/worker/src/index.ts`
- Test: `apps/worker/src/chunking/chunker.test.ts`
- Test: `apps/worker/src/jobs/process-ingestion-job.test.ts`

**Interfaces:**
- `DocumentExtractor.supportedMimeTypes: readonly string[]` and `extract(input: Buffer): Promise<ExtractedDocument>`.
- `EmbeddingClient.embed(inputs: readonly string[]): Promise<readonly number[][]>` is the worker's local port; the worker does not import an HTTP or provider SDK.
- `chunkText(text: string, options: ChunkOptions): DocumentChunkDraft[]` with deterministic ordering and source offsets.
- `processIngestionJob(jobId: string): Promise<void>` claims one job, extracts text, chunks it, asks the LLM service for embeddings, upserts vectors, and updates job/document status.

- [ ] **Step 1: Write chunker tests**

  Test stable chunk IDs/order, configured maximum size, overlap, preservation of source offsets, empty text rejection, and Unicode text.

- [ ] **Step 2: Write worker tests for failure and idempotency**

  Test unsupported MIME type produces `DOCUMENT_UNSUPPORTED`, extractor failure produces `INGESTION_FAILED`, a successful retry does not duplicate chunks, and each failed job is persisted as failed with a message.

- [ ] **Step 3: Run worker tests to verify they fail**

  Run: `pnpm --filter @agents-platform/worker test`

  Expected: FAIL because extractors, chunker, and job processor do not exist.

- [ ] **Step 4: Implement extraction and chunking**

  Support TXT first, then PDF and DOCX using focused extractor adapters. Keep extraction output independent of the source library. Use deterministic chunk IDs derived from document ID and ordinal.

- [ ] **Step 5: Implement the polling worker**

  Poll `JobRepository.claimNextPending`, process one job at a time by default, and release no duplicate work after a crash by using job status/attempt fields. Consume the local `EmbeddingClient` port; Task 5 supplies the production adapter through the LLM HTTP client, while unit tests inject a deterministic fake.

- [ ] **Step 6: Run worker tests and typecheck**

  Run: `pnpm --filter @agents-platform/worker test && pnpm typecheck`

  Expected: PASS.

- [ ] **Step 7: Commit**

  `git add apps/worker && git commit -m "feat: add document ingestion worker"`

### Task 5: Build the LLM gateway and provider adapters

**Files:**
- Create: `apps/llm/src/providers/llm-provider.ts`
- Create: `apps/llm/src/providers/mock-provider.ts`
- Create: `apps/llm/src/providers/openai-provider.ts`
- Create: `apps/llm/src/providers/azure-openai-provider.ts`
- Create: `apps/llm/src/provider-registry.ts`
- Create: `apps/llm/src/http/routes.ts`
- Create: `apps/llm/src/http/server.ts`
- Create: `apps/llm/src/index.ts`
- Create: `packages/clients/src/llm-client.ts`
- Test: `apps/llm/src/providers/mock-provider.test.ts`
- Test: `apps/llm/src/provider-registry.test.ts`
- Test: `apps/llm/src/http/routes.test.ts`

**Interfaces:**
- `LlmProvider.complete(request: CompletionRequest): Promise<CompletionResponse>`.
- `LlmProvider.embed(request: EmbeddingRequest): Promise<EmbeddingResponse>`.
- `LlmProvider.listModels(): Promise<ModelDescriptor[]>`.
- `createLlmProvider(config: LlmConfig): LlmProvider`.
- `LlmClient.complete`, `embed`, and `listModels` are typed HTTP clients used by agent and worker.

- [ ] **Step 1: Write provider and gateway tests**

  Assert the mock provider is deterministic, provider selection uses `LLM_PROVIDER`, invalid provider names fail at startup, request schemas reject missing model/input, and provider errors become `MODEL_UNAVAILABLE`.

- [ ] **Step 2: Add timeout tests**

  Use a hanging fake provider and assert the gateway returns a stable timeout error within the configured deadline.

- [ ] **Step 3: Run LLM tests to verify they fail**

  Run: `pnpm --filter @agents-platform/llm test`

  Expected: FAIL because the registry, adapters, and routes do not exist.

- [ ] **Step 4: Implement the provider interface and mock provider**

  The mock provider must return deterministic embeddings and a deterministic completion suitable for citation tests; it must never require network access.

- [ ] **Step 5: Implement real provider adapters**

  Translate OpenAI and Azure OpenAI SDK requests into the shared contracts. Keep API keys and endpoint configuration inside the LLM service.

- [ ] **Step 6: Implement Fastify routes and typed client**

  Add health, `POST /v1/completions`, `POST /v1/embeddings`, and `GET /v1/models`. Normalize all provider errors and enforce request timeouts.

- [ ] **Step 7: Run tests and typecheck**

  Run: `pnpm --filter @agents-platform/llm test && pnpm typecheck`

  Expected: PASS with the mock provider and no real credentials required.

- [ ] **Step 8: Commit**

  `git add apps/llm packages/clients/src/llm-client.ts && git commit -m "feat: add replaceable LLM gateway"`

### Task 6: Implement retrieval and the basic RAG agent runtime

**Files:**
- Create: `apps/agent/src/retrieval/retriever.ts`
- Create: `apps/agent/src/prompting/prompt-builder.ts`
- Create: `apps/agent/src/runtimes/agent-runtime.ts`
- Create: `apps/agent/src/runtimes/basic-rag-runtime.ts`
- Create: `apps/agent/src/runtime-registry.ts`
- Create: `apps/agent/src/http/routes.ts`
- Create: `apps/agent/src/http/server.ts`
- Create: `apps/agent/src/index.ts`
- Create: `packages/clients/src/agent-client.ts`
- Test: `apps/agent/src/retrieval/retriever.test.ts`
- Test: `apps/agent/src/prompting/prompt-builder.test.ts`
- Test: `apps/agent/src/runtimes/basic-rag-runtime.test.ts`
- Test: `apps/agent/src/http/routes.test.ts`

**Interfaces:**
- `Retriever.search(tenantId: string, knowledgeBaseIds: string[], query: string, limit: number): Promise<RetrievedChunk[]>`.
- `buildGroundedPrompt(input: PromptInput): Prompt`.
- `AgentRuntime.answer(request: AgentRequest): Promise<AgentResponse>`.
- `createAgentRuntime(name: string, dependencies: AgentDependencies): AgentRuntime`.
- `AgentClient.answer(request: AgentRequest): Promise<AgentResponse>`.

- [ ] **Step 1: Write retrieval and prompt tests**

  Assert tenant/knowledge-base scope is forwarded to the vector store, result ordering is stable, prompts label sources, and empty retrieval yields an explicit no-context prompt.

- [ ] **Step 2: Write runtime tests**

  Assert the basic runtime retrieves chunks, calls the LLM client once with grounded context, maps source chunks to citations, returns `traceId`, and produces a no-answer response with empty citations when no relevant context exists.

- [ ] **Step 3: Run agent tests to verify they fail**

  Run: `pnpm --filter @agents-platform/agent test`

  Expected: FAIL because retrieval, runtime, and routes do not exist.

- [ ] **Step 4: Implement retrieval and prompt construction**

  Keep prompt construction independent of any provider SDK. Include document ID, chunk ID, filename, and offsets in the internal source metadata used to build citations.

- [ ] **Step 5: Implement `basic-rag` and runtime registry**

  Select the runtime from `AGENT_RUNTIME`, inject the vector store and `LlmClient`, and translate downstream failures to stable agent errors.

- [ ] **Step 6: Implement agent HTTP routes and client**

  Add health and `POST /v1/answer`; validate all requests with shared Zod schemas and preserve the incoming trace ID or create one.

- [ ] **Step 7: Run tests and typecheck**

  Run: `pnpm --filter @agents-platform/agent test && pnpm typecheck`

  Expected: PASS.

- [ ] **Step 8: Commit**

  `git add apps/agent packages/clients/src/agent-client.ts && git commit -m "feat: add basic RAG agent service"`

### Task 7: Implement the public API and application orchestration

**Files:**
- Create: `apps/api/src/auth/development-identity.ts`
- Create: `apps/api/src/services/document-service.ts`
- Create: `apps/api/src/services/conversation-service.ts`
- Create: `apps/api/src/http/routes/documents.ts`
- Create: `apps/api/src/http/routes/conversations.ts`
- Create: `apps/api/src/http/routes/health.ts`
- Create: `apps/api/src/http/server.ts`
- Create: `apps/api/src/index.ts`
- Test: `apps/api/src/services/document-service.test.ts`
- Test: `apps/api/src/services/conversation-service.test.ts`
- Test: `apps/api/src/http/routes.test.ts`

**Interfaces:**
- `DevelopmentIdentity.resolve(request): TenantContext`.
- `DocumentService.upload(context, metadata, stream): Promise<Document>`.
- `DocumentService.list(context): Promise<DocumentSummary[]>`.
- `ConversationService.ask(context, request): Promise<AgentResponse>`.
- Public routes: `POST /v1/documents`, `GET /v1/documents`, `GET /v1/documents/:id`, `POST /v1/conversations`, `POST /v1/conversations/:id/messages`, and health endpoints.

- [ ] **Step 1: Write service tests**

  Assert uploads store the file, create tenant-owned metadata and an ingestion job, conversation messages persist before/after agent calls as designed, and agent failures produce stable API errors.

- [ ] **Step 2: Write tenant-isolation route tests**

  Assert a request cannot select another tenant by body, query string, or path value; the development identity is the only source of tenant context.

- [ ] **Step 3: Run API tests to verify they fail**

  Run: `pnpm --filter @agents-platform/api test`

  Expected: FAIL because services and routes do not exist.

- [ ] **Step 4: Implement development identity and document routes**

  Use `TENANT_ID` as the fixed local identity. Validate MIME type/size before object storage, generate a document ID, and enqueue an ingestion job in the same database transaction as metadata.

- [ ] **Step 5: Implement conversation routes**

  Validate conversation ownership, pass only server-derived tenant context to the agent client, persist user/assistant messages, and return citations and trace metadata.

- [ ] **Step 6: Run API tests and typecheck**

  Run: `pnpm --filter @agents-platform/api test && pnpm typecheck`

  Expected: PASS.

- [ ] **Step 7: Commit**

  `git add apps/api && git commit -m "feat: add public Q&A API"`

### Task 8: Build the React prototype UI

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/components/DocumentUploader.tsx`
- Create: `apps/web/src/components/DocumentList.tsx`
- Create: `apps/web/src/components/ChatPanel.tsx`
- Create: `apps/web/src/components/CitationList.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles.css`
- Test: `apps/web/src/components/ChatPanel.test.tsx`
- Test: `apps/web/src/components/DocumentUploader.test.tsx`

**Interfaces:**
- `api/client.ts` exposes typed `listDocuments`, `uploadDocument`, `createConversation`, and `sendMessage` functions using API contracts.
- `ChatPanel` renders messages, loading, API errors, and citations without knowing agent or LLM details.
- `DocumentUploader` reports upload progress and ingestion status.

- [ ] **Step 1: Write component tests**

  Assert upload controls accept supported files and show failure state, chat renders an answer and citations, and no-answer responses render without fake citations.

- [ ] **Step 2: Run UI tests to verify they fail**

  Run: `pnpm --filter @agents-platform/web test`

  Expected: FAIL because the Vite app and components do not exist.

- [ ] **Step 3: Implement the typed API client and layout**

  Keep the UI single-tenant and focused on the vertical slice: document list/upload on one side and conversation/chat on the other.

- [ ] **Step 4: Implement document and chat state**

  Poll document status after upload, disable chat until at least one document is ready, and display citation metadata from the API response.

- [ ] **Step 5: Run UI tests and build**

  Run: `pnpm --filter @agents-platform/web test && pnpm --filter @agents-platform/web build`

  Expected: PASS and a production bundle is generated.

- [ ] **Step 6: Commit**

  `git add apps/web && git commit -m "feat: add document Q&A web prototype"`

### Task 9: Wire services, run end-to-end flow, and add evaluation fixtures

**Files:**
- Modify: `docker-compose.yml`
- Create: `infra/postgres/init.sql`
- Create: `tests/integration/document-to-answer.test.ts`
- Create: `tests/evaluation/fixtures/handbook.txt`
- Create: `tests/evaluation/basic-rag.evaluation.test.ts`
- Create: `scripts/wait-for-services.ts`
- Create: `README.md`

**Interfaces:**
- Compose exposes only web/API externally; agent, LLM, and worker communicate on the internal network.
- The end-to-end test uses only the mock provider and asserts the full upload → ingestion → question → citation flow.
- The evaluation fixture and expected answer/citation assertions are stable and provider-independent.

- [ ] **Step 1: Write the end-to-end test**

  Start with a fixture containing a fact and a distractor. Upload it, wait for `READY`, ask a question, and assert the answer contains the grounded fact, includes the source document/chunk citation, and has a trace ID.

- [ ] **Step 2: Run the end-to-end test to verify it fails**

  Run: `docker compose up -d; pnpm test:integration -- tests/integration/document-to-answer.test.ts`

  Expected: FAIL until all services are wired and started.

- [ ] **Step 3: Wire Compose services and startup ordering**

  Add build targets, internal URLs, health checks, database initialization, MinIO bucket creation, and worker startup. Do not expose agent or LLM ports as public application endpoints.

- [ ] **Step 4: Implement the end-to-end test harness**

  Use the API over HTTP, poll document status with a bounded timeout, and clean the test tenant/database rows between runs.

- [ ] **Step 5: Add the evaluation fixture and test**

  Assert the same fixture can be run against `basic-rag` and the mock provider, with citations mapped to the expected chunk rather than merely checking non-empty text.

- [ ] **Step 6: Document local setup and experiments**

  README must include prerequisites, `cp .env.example .env`, `docker compose up`, test commands, service URLs, and how to switch `AGENT_RUNTIME`/`LLM_PROVIDER`.

- [ ] **Step 7: Run the complete verification suite**

  Run: `docker compose up -d; pnpm typecheck; pnpm test; pnpm test:integration; pnpm --filter @agents-platform/web build`

  Expected: all unit, contract, integration, evaluation, and end-to-end tests pass; web build completes.

- [ ] **Step 8: Commit**

  `git add docker-compose.yml infra tests scripts README.md && git commit -m "test: wire prototype end to end"`

### Task 10: Final verification and handoff

**Files:**
- Modify: `README.md` if verification discovers setup gaps.
- Create: `docs/superpowers/verification/2026-10-15-multi-tenant-qa-platform-verification.md`

- [ ] **Step 1: Run the clean-start verification**

  Remove only the project’s named Docker volumes after confirming their exact names, restart from a clean checkout state, and run the documented setup and test commands.

- [ ] **Step 2: Verify replaceability**

  Run the deterministic suite once with `AGENT_RUNTIME=basic-rag` and `LLM_PROVIDER=mock`; verify provider selection and runtime selection are configuration changes, not source edits.

- [ ] **Step 3: Verify failure paths**

  Exercise unsupported upload, failed embedding, LLM timeout, empty retrieval, and duplicate job retry. Confirm stable error codes and no cross-tenant data.

- [ ] **Step 4: Record evidence**

  Write commands, pass/fail output summaries, known prototype limitations, and the recommended next sub-project (production authentication/multi-tenancy) in the verification note.

- [ ] **Step 5: Commit**

  `git add README.md docs/superpowers/verification/2026-10-15-multi-tenant-qa-platform-verification.md && git commit -m "docs: record prototype verification"`

