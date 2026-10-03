import { describe, expect, it } from "vitest";
import { noteFromFrequency } from "../src/audio/dsp/noteMath";

describe("notas", () => {
  it("reconoce el la 440 como A4 afinado", () => {
    expect(noteFromFrequency(440)).toEqual({ name: "A", octave: 4, cents: 0 });
  });

  it("rechaza una frecuencia que no puede sonar", () => {
    expect(() => noteFromFrequency(0)).toThrow(/positiva/);
  });
});
