import { defineConfig } from '@playwright/test';

// Cloud sync tests against the local Firebase emulator (no real Firebase project).
// Run with `npm run test:sync` (needs Java; the emulator downloads on first use).
export default defineConfig({
  testDir: 'e2e-sync',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4174/',
    viewport: { width: 390, height: 844 },
    trace: 'off',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'VITE_FIREBASE_EMULATOR=1 VITE_OWNER_EMAIL_SHA256=c8cd3c6427301eaf6665bccacd65ddb614527acc843a15463e3faba57124c351 npx vite build --outDir dist-sync && npx vite preview --outDir dist-sync --port 4174 --strictPort',
    url: 'http://localhost:4174/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
