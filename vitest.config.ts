import { defineConfig } from 'vitest/config';

// Unit tests for the app's logic (no browser needed). End-to-end tests live in e2e/ (Playwright).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
