import { defineConfig } from 'vitest/config';

// Relative base so the build works on a GitHub Pages project site (/Rugby-Coach/).
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  test: { include: ['src/**/*.test.ts'] },
});
