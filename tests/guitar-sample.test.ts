import { describe, expect, it } from "vitest";
import { guitarSampleName } from "../src/audio/guitarTone";

describe("muestras de guitarra", () => {
  it("nombra la cuerda 6 al aire como E2", () => {
    expect(guitarSampleName(40)).toBe("E2");
  });

  it("usa bemoles, que es el nombre del archivo", () => {
    expect(guitarSampleName(42)).toBe("Gb2");
    expect(guitarSampleName(46)).toBe("Bb2");
  });

  it("nombra el La del diapasón como A4", () => {
    expect(guitarSampleName(69)).toBe("A4");
  });
});
