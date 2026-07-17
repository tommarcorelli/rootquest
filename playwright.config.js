const { defineConfig } = require('@playwright/test');

// Locally we use the already-installed system Chrome (no browser download).
// In CI we use Playwright's bundled Chromium (installed by the workflow).
module.exports = defineConfig({
    testDir: './tests',
    testMatch: '**/*.spec.js',
    timeout: 30000,
    expect: { timeout: 7000 },
    // e2e stability: the victory modal is shown via a short setTimeout that browsers
    // throttle in backgrounded tabs, so cap concurrency and allow a retry.
    fullyParallel: true,
    workers: 2,
    retries: process.env.CI ? 2 : 1,
    reporter: process.env.CI ? 'line' : 'list',
    use: {
        baseURL: 'http://localhost:4173',
        headless: true,
        channel: process.env.CI ? undefined : 'chrome',
        trace: 'on-first-retry',
    },
    webServer: {
        command: 'node tests/serve.js',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 20000,
    },
});
