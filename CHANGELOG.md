# Changelog

All notable changes to this project are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com). Update this file with every code change (see `AGENTS.md`).

## [Unreleased]

### Added
- Vietnamese sample document `company-handbook.vi.md` for `pnpm seed`, with a Vietnamese sample question for `--ask`.
- `RETRIEVAL_MIN_SCORE` (absolute floor) and `RETRIEVAL_SCORE_MARGIN` (distance below the best hit) drop low-similarity chunks before prompting and citing, so small local models are not distracted by irrelevant sources (both default `0`, off). A high absolute floor such as 0.6 can empty the results because `nomic-embed-text` scores are compressed.

### Changed
- Embedding vectors are now 768-dimensional (was 1536) so local models work: migration `003_embedding_768.sql` resizes the pgvector column, drops stored chunks and re-queues every existing document for re-embedding. OpenAI/Azure embeddings request 768 dimensions; the mock provider returns 768.
- The `ollama` provider now embeds with a real local model (`LLM_EMBEDDING_MODEL`, default `nomic-embed-text`) instead of mock vectors, so retrieval is semantic; `docker-compose.ollama.yml` pulls the embedding model too.

### Added
- `docker-compose.ollama.yml` runs a local Ollama server in Docker and pulls `llama3.2:3b` (override with `OLLAMA_MODEL`/`OLLAMA_PORT`).
- Chat failures now show the server stack trace in the web app (collapsible "Stack trace"); the API includes `stack` in `503 AGENT_UNAVAILABLE` responses only when `NODE_ENV` is not `production`.
- `ollama` LLM provider (`LLM_PROVIDER=ollama`, `LLM_BASE_URL`, `LLM_MODEL`) routes chat to a local Ollama server without an API key; embeddings stay on the mock provider because the vector column is 1536-dimensional.
- Manage uploaded documents in the web app: click a document to see its extracted text beside the chunks the agent searches (chunk boundaries and overlaps highlighted), and delete it with confirmation.
- `DELETE /v1/documents/:id` removes a document with its stored file, chunks, embeddings and ingestion jobs; `GET /v1/documents/:id/chunks` returns the re-extracted text and stored chunks.
- Shared VS Code settings (`.vscode`) that format with Prettier and fix ESLint issues on save.
- ESLint (typescript-eslint, react-hooks) and Prettier with `pnpm lint`, `lint:fix`, `format` and `format:check` scripts; a Husky pre-commit hook runs lint-staged on staged files.

### Fixed
- Deleting a document in the web app failed with a 400 because the `DELETE` request carried a JSON content-type with no body; it now sends only the tenant header.
- `LLM_TIMEOUT_MS` now also sets the upstream provider request timeout (previously fixed at 15s) and is passed through Docker Compose.
- The OpenAI/Azure provider now maps responses to the gateway contract (it returned raw OpenAI JSON) and sends `max_tokens`/`response_format` correctly.
- Markdown (`text/markdown`) uploads are now ingested instead of failing as unsupported.
- Chat now works against the real API: the web client no longer sends the non-UUID `default` knowledge base id, and the API maps `default` to the tenant default knowledge base.
- LLM gateway returns `400 INVALID_REQUEST` for malformed requests, enforces a gateway-level timeout (`504 MODEL_TIMEOUT`, `LLM_TIMEOUT_MS`), and Azure OpenAI now authenticates with the `api-key` header.
- Conversations persist user and assistant messages and send prior turns to the agent; citations show the real document filename.
- The web app can now start a conversation against the real API: it sent a JSON content-type with an empty body, which Fastify rejected with 400.
- The web app no longer renders a blank page with `React is not defined`: Vite now uses the automatic JSX runtime.
- The agent service now retrieves from pgvector (it used an empty stub), and the API searches the tenant's default knowledge base when a request names none, so questions are answered from ingested documents.
- Document upload and conversations no longer fail against PostgreSQL: documents are filed under a per-tenant default knowledge base UUID (created on demand) instead of the invalid `'default'`, and non-UUID tenant keys such as `local` are mapped to stable tenant UUIDs.

### Changed
- Text extractors and the chunker moved from `apps/worker` into the shared `@agents-platform/ingestion` package so the API and worker use the same chunking.
- Reformatted the codebase with Prettier and removed unused imports flagged by ESLint.
- Compose publishes Postgres on `${POSTGRES_PORT:-5432}` so it can avoid a local PostgreSQL on the same port.
- Compose no longer publishes the agent and LLM ports; only web and API are public.
- Compose now uses `bitnamilegacy/minio` for object storage because `minio/minio` is no longer published on Docker Hub.

### Added
- `pnpm seed` loads sample documents (handbook, product FAQ, security policy, onboarding guide) into the running app through the API and can ask sample questions (`pnpm seed -- --ask`).
- Agent prompt builder and retriever port, LLM/agent `server.ts` factories, API tenant-spoofing and history tests, a real-stack Playwright test (upload to cited answer), and a verification note under `docs/superpowers/verification/`.
- Integration test for the full document-to-answer flow and a provider-independent `basic-rag` evaluation over a handbook fixture; Postgres init script enabling pgvector.
- Web UI: document upload (txt, md, pdf, docx), a document list with live ingestion status, and a chat panel with citations; chat stays disabled until a document is ready. Component tests run under Vitest + Testing Library, wired into the root `pnpm test` via a Vitest projects config.
- Playwright browser end-to-end tests for the Q&A web app (`pnpm test:e2e`), running against the Vite dev server with the API stubbed so no backend is required.
- Docker Compose now runs every app (api, agent, llm, worker, web) in its own container from a shared multi-target `Dockerfile`, with a `minio-init` job that creates the document bucket.
- Project documentation under `docs/` (architecture, services, API reference, data model, configuration, development guide, known gaps).
