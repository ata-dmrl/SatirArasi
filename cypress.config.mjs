import { defineConfig } from 'cypress';

export default defineConfig({
  video: true,
  videoCompression: 28,
  screenshotOnRunFailure: true,
  viewportWidth: 1000,
  viewportHeight: 640,
  e2e: {
    baseUrl: 'http://localhost:4173',
    includeShadowDom: true,
    supportFile: 'cypress/support/e2e.js',
    defaultCommandTimeout: 10000,
  },
});
