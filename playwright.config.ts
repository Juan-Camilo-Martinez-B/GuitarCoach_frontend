import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  // El recorrido contra la API real tiene su propia configuración: playwright.live.config.ts.
  testIgnore: "live/**",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4173" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
});
