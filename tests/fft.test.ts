import { describe, expect, it } from "vitest";
import { fftMagnitudes } from "../src/audio/dsp/fft";

describe("FFT", () => {
  it("concentra una cosenoide en su bin", () => {
    const size = 8;
    const samples = new Float32Array(size);
    for (let index = 0; index < size; index += 1) {
      samples[index] = Math.cos((2 * Math.PI * index) / size);
    }
    const magnitudes = fftMagnitudes(samples);
    const peak = magnitudes.reduce(
      (best, value, index) => (value > magnitudes[best] ? index : best),
      0,
    );
    expect(peak).toBe(1);
  });
});
