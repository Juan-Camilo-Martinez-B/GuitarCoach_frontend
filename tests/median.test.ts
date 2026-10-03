import { describe, expect, it } from "vitest";
import { movingMedian } from "../src/audio/dsp/median";

describe("mediana móvil", () => {
  it("ignora un pico aislado", () => {
    expect(movingMedian([1, 1, 100, 1, 1], 3)).toEqual([1, 1, 1, 1, 1]);
  });
});
