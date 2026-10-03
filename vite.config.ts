import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { ISOLATION_HEADERS } from "./src/audio/tuner/channel";

export default defineConfig({
  plugins: [react()],
  server: { headers: ISOLATION_HEADERS },
  preview: { headers: ISOLATION_HEADERS },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
