import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { proxy: { '/api': 'http://127.0.0.1:3001', '/socket.io': { target: 'http://127.0.0.1:3001', ws: true } } },
  test: { environment: 'jsdom', setupFiles: './src/test-setup.ts', pool: 'threads', maxWorkers: 1 },
});
