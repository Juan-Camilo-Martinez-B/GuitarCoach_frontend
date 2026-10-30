import { describe, expect, it } from "vitest";
import { chordCandidates, chordFrame, judgeChord } from "../src/audio/dsp/chordRecognizer";

const RATE = 44100;
const SIZE = 8192;

/** Cuerdas pulsadas aproximadas: cada nota con seis armónicos que decaen. */
function strum(midis: number[]): Float32Array {
  const samples = new Float32Array(SIZE);
  for (const midi of midis) {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    for (let harmonic = 1; harmonic <= 6; harmonic += 1) {
      for (let index = 0; index < SIZE; index += 1) {
        samples[index] +=
          (0.05 / harmonic) * Math.sin((2 * Math.PI * frequency * harmonic * index) / RATE);
      }
    }
  }
  return samples;
}

const SHAPES: Record<string, number[]> = {
  G: [43, 47, 50, 55, 59, 67],
  Em: [40, 47, 52, 55, 59, 64],
  C: [48, 52, 55, 60, 64],
  Am: [45, 52, 57, 60, 64],
  D: [50, 57, 62, 66],
};

function judge(played: string, expected: string, song: string[] = []) {
  const frame = chordFrame(strum(SHAPES[played]), RATE);
  expect(frame).not.toBeNull();
  return judgeChord(frame as Float32Array, expected, chordCandidates(expected, song));
}

describe("reconocimiento de acordes por croma", () => {
  it.each(Object.keys(SHAPES))("reconoce %s tocado completo", (symbol) => {
    expect(judge(symbol, symbol).ok).toBe(true);
  });

  it("no acepta Mim cuando suena Sol, aunque compartan dos notas", () => {
    const result = judge("G", "Em", ["G", "D", "Em", "C"]);
    expect(result.ok).toBe(false);
    expect(result.heard).toBe("G");
  });

  it("no acepta Lam cuando suena Do", () => {
    expect(judge("C", "Am", ["C", "Am"]).ok).toBe(false);
  });

  it("no da por bueno el acorde si solo suena la fundamental", () => {
    const frame = chordFrame(strum([48]), RATE) as Float32Array;
    expect(judgeChord(frame, "Cm", chordCandidates("Cm")).ok).toBe(false);
  });

  it("ignora el silencio", () => {
    expect(chordFrame(new Float32Array(SIZE), RATE)).toBeNull();
  });
});
