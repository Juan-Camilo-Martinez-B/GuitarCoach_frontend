import { expect, test } from "@playwright/test";

const PROGRESSION = ["G", "D", "Em", "C", "Am", "E", "A", "D", "G", "C", "Em", "D"];
// Escala de Sol con saltos, en el registro de una melodía de guitarra.
const MELODY = [55, 57, 59, 60, 62, 64, 66, 67, 64, 62, 59, 57, 55, 59, 62, 67, 69, 71, 67, 64];

async function bench<T>(
  page: import("@playwright/test").Page,
  name: string,
  args: unknown[],
): Promise<T> {
  return page.evaluate(
    async ({ name: fn, args: list }) => {
      const module = (await import(/* @vite-ignore */ "/e2e/support/listeningBench.ts")) as Record<
        string,
        (...values: unknown[]) => Promise<unknown>
      >;
      return module[fn](...list);
    },
    { name, args },
  ) as Promise<T>;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/glosario");
});

test.describe("acordes con muestras reales de guitarra", () => {
  // bpm y tiempos por acorde: la última fila es un acorde en cada corchea a 240 BPM (125 ms).
  for (const [bpm, beats, minimum] of [
    [72, 4, 1],
    [120, 2, 1],
    [180, 2, 0.9],
    [240, 1, 0.9],
    [240, 0.5, 0.75],
  ] as const) {
    test(`reconoce la progresión a ${bpm} BPM con ${beats} tiempos por acorde`, async ({
      page,
    }) => {
      const result = await bench<{
        accuracy: number;
        onsetRecall: number;
        medianOnsetErrorMs: number;
        realtimeFactor: number;
      }>(page, "chordBench", [PROGRESSION, bpm, beats]);
      console.log(`acordes ${bpm} BPM x${beats}:`, JSON.stringify(result));
      expect(result.accuracy).toBeGreaterThanOrEqual(minimum);
      expect(result.onsetRecall).toBeGreaterThanOrEqual(0.9);
      expect(result.medianOnsetErrorMs).toBeLessThanOrEqual(30);
      // Debe sobrar tiempo de cómputo para correr en vivo.
      expect(result.realtimeFactor).toBeGreaterThan(3);
    });
  }

  test("no da por buenos los acordes equivocados en una canción rápida", async ({ page }) => {
    const played = ["G", "D", "Em", "C", "Am", "E", "G", "D"];
    const expected = ["C", "A", "G", "E", "D", "G", "Am", "Em"];
    const result = await bench<{ accepted: number; slots: number }>(page, "wrongChordBench", [
      played,
      expected,
      200,
      1,
    ]);
    console.log("acordes equivocados:", JSON.stringify(result));
    expect(result.accepted).toBeLessThanOrEqual(1);
  });
});

test.describe("melodías con muestras reales de guitarra", () => {
  // Las semicorcheas a 200 BPM son 75 ms por nota; a 300 BPM, 50 ms.
  for (const [bpm, perBeat, minimum] of [
    [90, 2, 0.95],
    [160, 2, 0.95],
    [200, 4, 0.8],
    [300, 4, 0.6],
  ] as const) {
    test(`reconoce la melodía a ${bpm} BPM con ${perBeat} notas por tiempo`, async ({ page }) => {
      const result = await bench<{ followerAccuracy: number; realtimeFactor: number }>(
        page,
        "melodyBench",
        [MELODY, bpm, perBeat],
      );
      console.log(`melodía ${bpm} BPM x${perBeat}:`, JSON.stringify(result));
      expect(result.followerAccuracy / 100).toBeGreaterThanOrEqual(minimum);
      expect(result.realtimeFactor).toBeGreaterThan(3);
    });
  }
});
