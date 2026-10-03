import { describe, expect, it } from "vitest";
import { applyGate } from "../src/audio/dsp/gate";

describe("compuerta de ruido", () => {
  it("silencia un bloque por debajo del umbral", () => {
    const gated = applyGate(new Float32Array([0.01, -0.01]), 0.1);
    expect(Array.from(gated)).toEqual([0, 0]);
  });
});
