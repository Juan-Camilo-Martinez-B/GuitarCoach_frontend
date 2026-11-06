import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Recorrido contra la API real: necesita uvicorn en el puerto 8000 con PostgreSQL y Redis.
// El micrófono es un dispositivo falso de Chromium que reproduce este archivo en bucle.
const RATE = 44100;
const G_CHORD = [43, 47, 50, 55, 59, 67];

function fakeMicrophone(path: string): void {
  const seconds = 8;
  const count = RATE * seconds;
  const samples = new Float64Array(count);
  // Un acorde de Sol cada medio segundo, con armónicos que decaen como una cuerda.
  for (let strum = 0; strum < seconds * 2; strum += 1) {
    const start = strum * 0.5 * RATE;
    for (const midi of G_CHORD) {
      const frequency = 440 * 2 ** ((midi - 69) / 12);
      for (let index = 0; index < 0.5 * RATE && start + index < count; index += 1) {
        const time = index / RATE;
        for (let harmonic = 1; harmonic <= 5; harmonic += 1) {
          samples[start + index] +=
            (0.05 / harmonic) *
            Math.exp(-time * (2 + harmonic)) *
            Math.sin(2 * Math.PI * frequency * harmonic * time);
        }
      }
    }
  }
  const data = Buffer.alloc(44 + count * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + count * 2, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(RATE, 24);
  data.writeUInt32LE(RATE * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(count * 2, 40);
  samples.forEach((value, index) => {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + index * 2);
  });
  writeFileSync(path, data);
}

const micFile = resolve("test-results/fake-mic.wav");
mkdirSync(resolve("test-results"), { recursive: true });
fakeMicrophone(micFile);

export default defineConfig({
  testDir: "e2e/live",
  timeout: 120_000,
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:4173",
    permissions: ["microphone"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${micFile}`,
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
  webServer: {
    command: "npx vite --host localhost --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
  },
});
