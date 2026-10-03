import { describe, expect, it } from "vitest";
import { chroma } from "../src/audio/dsp/chroma";
import { bestChord, templateFor, vote } from "../src/audio/dsp/chordTemplates";

describe("acordes por croma", () => {
  it("elige el mayor de do y vota la mayoría", () => {
    const frame = templateFor("C");
    expect(bestChord(frame, ["C", "G", "Am"])).toBe("C");
    expect(vote(["C", "Am", "C"])).toBe("C");
    const spectrum = new Float32Array(8);
    spectrum[1] = 1;
    const bins = chroma(spectrum, 7040);
    expect(bins[9]).toBe(1);
  });
});
