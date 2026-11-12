import { defineConfig } from 'vite';

export default defineConfig({
  // apps/web has no tsconfig, so Vite would default to the classic JSX transform and crash with "React is not defined".
  esbuild: { jsx: 'automatic' },
  server: { port: 5173, proxy: { '/v1': 'http://localhost:4100' } },
  build: { outDir: 'dist' },
});
