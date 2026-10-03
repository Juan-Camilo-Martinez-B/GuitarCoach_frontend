import { describe, expect, it } from "vitest";
import { sineWave } from "../src/audio/dsp/yin";
import { handleDspMessage } from "../src/audio/workers/dsp.worker";
import { createSampleChannel, needleX } from "../src/audio/tuner/channel";

describe("canal y afinador", () => {
  it("cae a postMessage cuando no hay memoria compartida", () => {
    expect(createSampleChannel(8, false).kind).toBe("message");
  });

  it("centra la aguja en cero cents", () => {
    expect(needleX(0, 200)).toBe(100);
    expect(needleX(80, 200)).toBe(200);
  });

  it("el worker devuelve la frecuencia estimada", () => {
    const response = handleDspMessage({
      type: "pitch",
      samples: sineWave(110, 44100, 4096),
      sampleRate: 44100,
    });
    expect(response.frequency ?? 0).toBeCloseTo(110, 0);
  });
});
