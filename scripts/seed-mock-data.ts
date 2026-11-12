/**
 * Seeds the running app with sample documents and, optionally, asks sample questions.
 *
 * Usage:
 *   node scripts/seed-mock-data.ts [--api-url http://localhost:4100] [--tenant local] [--ask] [--timeout 90]
 *
 * Documents are uploaded through the public API, so the worker ingests them exactly as it would a
 * real upload. The script is idempotent: documents whose filename already exists for the tenant are
 * skipped. The default tenant `local` is the one the web UI uses.
 *
 * Requires the stack to be running (`docker compose up -d --build --wait`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const sampleQuestions: Record<string, string> = {
  'company-handbook.md': 'How many vacation days do full-time employees get?',
  'product-faq.md': 'What is the refund policy for annual subscriptions?',
  'security-policy.txt': 'How quickly must a security incident be reported?',
  'onboarding-guide.txt': 'On which days do we release?'
};
const contentTypes: Record<string, string> = { '.md': 'text/markdown', '.txt': 'text/plain' };

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

const apiUrl = option('api-url', process.env.API_URL ?? 'http://localhost:4100').replace(/\/$/, '');
const tenant = option('tenant', process.env.TENANT_ID ?? 'local');
const timeoutMs = Number(option('timeout', '90')) * 1000;
const askQuestions = process.argv.includes('--ask');
const dataDir = join(process.cwd(), 'scripts', 'mock-data');
const headers = { 'content-type': 'application/json', 'x-tenant-id': tenant };

interface DocumentSummary {
  id: string;
  filename: string;
  status: string;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  if (!response.ok)
    throw new Error(`${init.method ?? 'GET'} ${path} failed with ${response.status}`);
  return (await response.json()) as T;
}

async function waitForReady(ids: string[]): Promise<Map<string, string>> {
  const statuses = new Map<string, string>();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const id of ids) {
      if (statuses.get(id) === 'ready' || statuses.get(id) === 'failed') continue;
      statuses.set(id, (await api<DocumentSummary>(`/v1/documents/${id}`)).status);
    }
    if (ids.every((id) => ['ready', 'failed'].includes(statuses.get(id) ?? ''))) break;
    await delay(1000);
  }
  return statuses;
}

async function main(): Promise<void> {
  const health = await fetch(`${apiUrl}/health`).then(
    (r) => r.ok,
    () => false
  );
  if (!health) {
    console.error(
      `API not reachable at ${apiUrl}. Start it with: docker compose up -d --build --wait`
    );
    process.exit(1);
  }

  const existing = new Map(
    (await api<DocumentSummary[]>('/v1/documents')).map((d) => [d.filename, d])
  );
  const files = readdirSync(dataDir)
    .filter((name) => extname(name) in contentTypes)
    .sort();
  const pending: DocumentSummary[] = [];

  console.log(`Seeding tenant "${tenant}" at ${apiUrl}`);
  for (const name of files) {
    const known = existing.get(name);
    if (known) {
      console.log(`  skip    ${name} (already ${known.status})`);
      continue;
    }
    const content = readFileSync(join(dataDir, name));
    const document = await api<DocumentSummary>('/v1/documents', {
      method: 'POST',
      body: JSON.stringify({
        filename: basename(name),
        contentType: contentTypes[extname(name)],
        sizeBytes: content.length,
        contentBase64: content.toString('base64')
      })
    });
    console.log(`  upload  ${name}`);
    pending.push(document);
  }

  if (pending.length > 0) {
    console.log('Waiting for ingestion...');
    const statuses = await waitForReady(pending.map((d) => d.id));
    for (const document of pending)
      console.log(`  ${(statuses.get(document.id) ?? 'timeout').padEnd(8)}${document.filename}`);
    if (pending.some((d) => statuses.get(d.id) !== 'ready')) {
      console.error('Some documents did not become ready.');
      process.exitCode = 1;
    }
  }

  if (askQuestions) {
    console.log('Sample questions:');
    const conversation = await api<{ id: string }>('/v1/conversations', {
      method: 'POST',
      body: '{}'
    });
    for (const [file, question] of Object.entries(sampleQuestions)) {
      const reply = await api<{ answer: string; citations: { filename: string }[] }>(
        `/v1/conversations/${conversation.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ message: question })
        }
      );
      const sources = [...new Set(reply.citations.map((c) => c.filename))].join(', ') || 'none';
      console.log(
        `  Q (${file}): ${question}\n    sources: ${sources}\n    ${reply.answer.split('\n')[0]!.slice(0, 160)}`
      );
    }
  }
  console.log('Done. Open http://localhost:5173 to ask questions.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
