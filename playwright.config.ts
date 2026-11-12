import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_WEB_PORT ?? 5273);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Starts its own Vite dev server on a dedicated port (so it never reuses the Docker web container on 5173),
  // unless an already running app is targeted via E2E_BASE_URL.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm --filter @agents-platform/web exec vite --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 60_000,
      },
});
