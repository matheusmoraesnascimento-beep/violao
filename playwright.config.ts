import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: { baseURL: 'http://localhost:4173' },
  // launchOptions cannot be set inside a describe group, so the fake-mic test gets its own project.
  projects: [
    { name: 'default', grepInvert: /microfone falso/ },
    {
      name: 'fake-mic',
      grep: /microfone falso/,
      use: { launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] } },
    },
  ],
});
