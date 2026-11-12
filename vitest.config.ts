import { configDefaults, defineConfig } from 'vitest/config';

// The web app needs a DOM environment, so it runs as its own project (apps/web/vitest.config.ts).
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'node', exclude: [...configDefaults.exclude, 'apps/web/**', 'e2e/**'] } },
      'apps/web',
    ],
  },
});
