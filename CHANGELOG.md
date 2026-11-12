# Changelog

All notable changes to this project are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com). Update this file with every code change (see `AGENTS.md`).

## [Unreleased]

### Fixed
- Markdown (`text/markdown`) uploads are now ingested instead of failing as unsupported.
- Chat now works against the real API: the web client no longer sends the non-UUID `default` knowledge base id, and the API maps `default` to the tenant default knowledge base.
- LLM gateway returns `400 INVALID_REQUEST` for malformed requests, enforces a gateway-level timeout (`504 MODEL_TIMEOUT`, `LLM_TIMEOUT_MS`), and Azure OpenAI now authenticates with the `api-key` header.
- Conversations persist user and assistant messages and send prior turns to the agent; citations show the real document filename.
- The web app can now start a conversation against the real API: it sent a JSON content-type with an empty body, which Fastify rejected with 400.
- The web app no longer renders a blank page with `React is not defined`: Vite now uses the automatic JSX runtime.
- The agent service now retrieves from pgvector (it used an empty stub), and the API searches the tenant's default knowledge base when a request names none, so questions are answered from ingested documents.
- Document upload and conversations no longer fail against PostgreSQL: documents are filed under a per-tenant default knowledge base UUID (created on demand) instead of the invalid `'default'`, and non-UUID tenant keys such as `local` are mapped to stable tenant UUIDs.

### Changed
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
