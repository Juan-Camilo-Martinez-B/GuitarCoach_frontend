import { describe, expect, it } from "vitest";
import { parseChord, validateChart } from "../src/domain/chart";

describe("carta de acordes", () => {
  it("separa la raíz de la calidad", () => {
    expect(parseChord("Am")).toEqual({ root: "A", quality: "m" });
    expect(parseChord("C")).toEqual({ root: "C", quality: "maj" });
    expect(parseChord("F#m")).toEqual({ root: "F#", quality: "m" });
  });

  it("rechaza una carta vacía o un símbolo imposible", () => {
    expect(() => validateChart([])).toThrow(/vacía/);
    expect(() => validateChart([{ bar: 1, beat: 1, chord: "H" }])).toThrow(/inválido/);
    expect(() => validateChart([{ bar: 0, beat: 1, chord: "C" }])).toThrow(/Compás/);
  });
});
