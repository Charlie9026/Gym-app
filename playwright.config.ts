import { defineConfig } from '@playwright/test';

// End-to-end tests against the production build, served the way GitHub Pages
// serves it (static files). Run with `npm run test:e2e`.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    viewport: { width: 390, height: 844 },
    trace: 'off',
    // Most tests don't want offline caching in the way; the PWA test turns it on.
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
