import { describe, expect, it } from "vitest";
import { sineWave, yinPitch } from "../src/audio/dsp/yin";

describe("YIN", () => {
  it("estima una senoide de 110 Hz", () => {
    const frequency = yinPitch(sineWave(110, 44100, 4096), 44100);
    expect(frequency).not.toBeNull();
    expect(frequency ?? 0).toBeCloseTo(110, 0);
  });

  it("no inventa un tono en silencio", () => {
    expect(yinPitch(new Float32Array(2048), 44100)).toBeNull();
  });
});
