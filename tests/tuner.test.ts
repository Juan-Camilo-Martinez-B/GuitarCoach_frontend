import { describe, expect, it } from "vitest";
import { sineWave } from "../src/audio/dsp/yin";
import { needleX } from "../src/audio/tuner/channel";
import { readingFromChunk } from "../src/audio/tuner/listen";

describe("canal y afinador", () => {
  it("centra la aguja en cero cents", () => {
    expect(needleX(0, 200)).toBe(100);
    expect(needleX(80, 200)).toBe(200);
  });

  it("lee la cuerda de la y el mi grave, y calla en silencio", () => {
    const la = readingFromChunk(sineWave(110, 44100, 4096), 44100);
    const mi = readingFromChunk(sineWave(82.41, 44100, 4096), 44100);
    expect(`${la?.name}${la?.octave}`).toBe("A2");
    expect(`${mi?.name}${mi?.octave}`).toBe("E2");
    expect(readingFromChunk(new Float32Array(4096), 44100)).toBeNull();
  });
});
