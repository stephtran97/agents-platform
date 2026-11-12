import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Real-stack browser test: no API stubbing. Needs `docker compose up -d --build --wait` (LLM_PROVIDER=mock).
// The Vite dev server proxies /v1 to the API on :4100. Skipped automatically when the API is unreachable.
const apiUrl = process.env.API_URL ?? 'http://localhost:4100';
const handbook = readFileSync(`${process.cwd()}/tests/evaluation/fixtures/handbook.txt`);

test.beforeEach(async ({ request }) => {
  const healthy = await request.get(`${apiUrl}/health`).then((r) => r.ok(), () => false);
  test.skip(!healthy, `API not reachable at ${apiUrl}`);
});

test('uploads a document, waits for ingestion, and answers with a citation', async ({ page }) => {
  // The web client hardcodes the dev tenant; give each run its own so results are deterministic.
  const tenant = `e2e-${randomUUID()}`;
  await page.route('**/v1/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-tenant-id': tenant } }));

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Ask question' })).toBeDisabled();
  await page.getByLabel('Your question').fill('How many vacation days do full-time employees accrue per year?');
  await expect(page.getByText('Chat unlocks once at least one document is ready.')).toBeVisible();

  await page.getByLabel('Upload a document').setInputFiles({ name: 'handbook.txt', mimeType: 'text/plain', buffer: handbook });
  await expect(page.getByText(/handbook\.txt uploaded/)).toBeVisible();

  const documents = page.getByRole('list', { name: 'Documents' });
  await expect(documents.getByText('Ready')).toBeVisible({ timeout: 60_000 });

  await page.getByRole('button', { name: 'Ask question' }).click();
  await expect(page.getByText('ANSWER', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.answer p')).toContainText('25 days of paid vacation');
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(page.locator('.answer li').first()).toContainText('handbook.txt');
});

test('shows a failure state for an unsupported file type without calling the API', async ({ page }) => {
  let uploads = 0;
  await page.route('**/v1/documents', (route) => {
    if (route.request().method() === 'POST') uploads += 1;
    return route.continue();
  });
  await page.goto('/');
  await page.getByLabel('Upload a document').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('x') });
  await expect(page.getByRole('alert')).toContainText('Unsupported file type');
  expect(uploads).toBe(0);
});
