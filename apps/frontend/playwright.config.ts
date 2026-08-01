import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "pnpm --filter @rent-yield/backend dev",
      reuseExistingServer: !process.env.CI,
      url: "http://127.0.0.1:3001/api/v1/explorer/bootstrap?country_code=CO&city_name=Barranquilla",
    },
    {
      command:
        "pnpm --filter @rent-yield/frontend exec vite --host 127.0.0.1 --port 4173",
      reuseExistingServer: !process.env.CI,
      url: "http://127.0.0.1:4173",
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
