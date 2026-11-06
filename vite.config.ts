import { defineConfig } from "vitest/config";
import { alphaTab } from "@coderline/alphatab-vite";
import react from "@vitejs/plugin-react";
import { ISOLATION_HEADERS } from "./src/audio/tuner/channel";

export default defineConfig({
  // alphaTab copia sus fuentes y el soundfont a /font y /soundfont, y prepara sus workers.
  plugins: [react(), alphaTab()],
  server: { headers: ISOLATION_HEADERS },
  preview: { headers: ISOLATION_HEADERS },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
