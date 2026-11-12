import { expect, test, type Page } from '@playwright/test';

// The browser tests are hermetic: the /v1 API is stubbed at the network layer,
// so they need no PostgreSQL, MinIO, or backend services.
const conversationId = '11111111-1111-4111-8111-111111111111';

async function stubApi(
  page: Page,
  options: { messageStatus?: number; documents?: unknown[] } = {}
) {
  await page.route('**/v1/documents', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        options.documents ?? [
          { id: 'doc-1', filename: 'policy.md', status: 'ready', sizeBytes: 10 }
        ]
      )
    })
  );
  const requests: { tenant: string | undefined; body: unknown }[] = [];
  await page.route('**/v1/conversations', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: conversationId })
    })
  );
  await page.route(`**/v1/conversations/${conversationId}/messages`, (route) => {
    const request = route.request();
    requests.push({ tenant: request.headers()['x-tenant-id'], body: request.postDataJSON() });
    if (options.messageStatus && options.messageStatus >= 400) {
      return route.fulfill({
        status: options.messageStatus,
        contentType: 'application/json',
        body: '{"error":"AGENT_UNAVAILABLE"}'
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        answer: 'Refunds are available within 30 days.',
        citations: [{ documentId: 'doc-1', chunkId: 'chunk-7', filename: 'policy.md', score: 0.91 }]
      })
    });
  });
  return requests;
}

test('renders the empty question form with the submit button disabled', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Ask your documents.' })).toBeVisible();
  await expect(page.getByLabel('Your question')).toBeEmpty();
  await expect(page.getByRole('button', { name: 'Ask question' })).toBeDisabled();
});

test('keeps the button disabled for whitespace-only input', async ({ page }) => {
  await stubApi(page);
  await page.goto('/');
  await page.getByLabel('Your question').fill('   ');
  await expect(page.getByRole('button', { name: 'Ask question' })).toBeDisabled();
});

test('asks a question and shows the answer with its sources', async ({ page }) => {
  const requests = await stubApi(page);
  await page.goto('/');
  await page.getByLabel('Your question').fill('What is the refund policy?');
  await page.getByRole('button', { name: 'Ask question' }).click();

  await expect(page.getByText('Refunds are available within 30 days.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Sources' }).locator('xpath=following-sibling::ul[1]/li')
  ).toHaveText('policy.md · chunk-7');
  expect(requests).toEqual([{ tenant: 'local', body: { message: 'What is the refund policy?' } }]);
});

test('shows a loading state while the agent is answering', async ({ page }) => {
  await stubApi(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/v1/conversations', async (route) => {
    await gate;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: conversationId })
    });
  });
  await page.goto('/');
  await page.getByLabel('Your question').fill('Anything?');
  await page.getByRole('button', { name: 'Ask question' }).click();
  await expect(page.getByRole('button', { name: 'Thinking…' })).toBeDisabled();
  release();
  await expect(page.getByText('Refunds are available within 30 days.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask question' })).toBeEnabled();
});

test('shows an error and no answer when the agent service fails', async ({ page }) => {
  await stubApi(page, { messageStatus: 503 });
  await page.goto('/');
  await page.getByLabel('Your question').fill('What is the refund policy?');
  await page.getByRole('button', { name: 'Ask question' }).click();

  await expect(page.getByText('The Q&A service is unavailable.')).toBeVisible();
  await expect(page.getByText('ANSWER', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ask question' })).toBeEnabled();
});

test('disables chat until a document is ready', async ({ page }) => {
  await stubApi(page, {
    documents: [{ id: 'doc-1', filename: 'policy.md', status: 'processing', sizeBytes: 10 }]
  });
  await page.goto('/');
  await page.getByLabel('Your question').fill('Anything?');
  await expect(page.getByRole('button', { name: 'Ask question' })).toBeDisabled();
  await expect(page.getByText('Chat unlocks once at least one document is ready.')).toBeVisible();
});
