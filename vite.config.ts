import { defineConfig } from 'vitest/config';

// Relative base so the build works on a GitHub Pages project site (/Rugby-Coach/).
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const build = `${(env.GITHUB_SHA ?? 'dev').slice(0, 7)} ${new Date().toISOString().slice(5, 16).replace('T', ' ')}`;

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(build) },
  build: { target: 'es2022' },
  test: { include: ['src/**/*.test.ts'] },
});
