import { cp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { alphaTab } from "@coderline/alphatab-vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { ISOLATION_HEADERS } from "./src/audio/tuner/channel";

const ALPHATAB_ASSET_DIRS = ["font", "soundfont"];

/**
 * El servidor de desarrollo fija la lista de public/ justo después de resolver la configuración,
 * y el plugin de alphaTab copia sus archivos más tarde. En un checkout limpio esas rutas
 * responderían index.html en el primer arranque, así que aquí se copian antes.
 */
function alphaTabAssetsBeforeServe(): Plugin {
  return {
    name: "guitarcoach:alphatab-assets-before-serve",
    apply: "serve",
    async configResolved({ root, publicDir }) {
      const source = resolve(root, "node_modules/@coderline/alphatab/dist");
      await Promise.all(
        ALPHATAB_ASSET_DIRS.map((dir) =>
          cp(join(source, dir), join(publicDir, dir), { recursive: true }),
        ),
      );
    },
  };
}

export default defineConfig({
  // alphaTab copia sus fuentes y el soundfont a /font y /soundfont, y prepara sus workers.
  plugins: [react(), alphaTabAssetsBeforeServe(), alphaTab()],
  server: { headers: ISOLATION_HEADERS },
  preview: { headers: ISOLATION_HEADERS },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
