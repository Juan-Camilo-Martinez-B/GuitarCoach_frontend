import { describe, expect, it } from "vitest";
import { parseChord, readChordSymbol, validateChart } from "../src/domain/chart";

describe("carta de acordes", () => {
  it("separa la raíz de la calidad", () => {
    expect(parseChord("Am")).toEqual({ root: "A", quality: "m" });
    expect(parseChord("C")).toEqual({ root: "C", quality: "maj" });
    expect(parseChord("F#m")).toEqual({ root: "F#", quality: "m" });
  });

  it("entiende el cifrado de un cancionero y de una tablatura", () => {
    expect(readChordSymbol("Lam")).toBe("Am");
    expect(readChordSymbol("Sol")).toBe("G");
    expect(readChordSymbol("Mim")).toBe("Em");
    expect(readChordSymbol("Fa#m")).toBe("F#m");
    expect(readChordSymbol("La menor")).toBe("Am");
    expect(readChordSymbol("F/A")).toBe("F");
    expect(readChordSymbol("C5")).toBe("C");
    expect(readChordSymbol("(Am)*")).toBe("Am");
    expect(readChordSymbol("N.C.")).toBeNull();
    expect(readChordSymbol("Verso")).toBeNull();
  });

  it("rechaza una carta vacía o un símbolo imposible", () => {
    expect(() => validateChart([])).toThrow(/vacía/);
    expect(() => validateChart([{ bar: 1, beat: 1, chord: "H" }])).toThrow(/inválido/);
    expect(() => validateChart([{ bar: 0, beat: 1, chord: "C" }])).toThrow(/Compás/);
  });
});
