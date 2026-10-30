import { describe, expect, it } from "vitest";
import type { GuitarSample } from "../src/audio/guitar/sampleBank";
import { strikeBrightness, strikeGain, StringVoices } from "../src/audio/guitar/stringVoices";

interface FakeSource {
  stops: number[];
}

function fakeParam() {
  return {
    value: 0,
    cancelled: [] as number[],
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    setTargetAtTime() {},
    cancelScheduledValues(time: number) {
      this.cancelled.push(time);
    },
  };
}

function fakeContext() {
  const sources: FakeSource[] = [];
  const node = () => ({ connect() {}, disconnect() {} });
  const context = {
    currentTime: 0,
    createBufferSource() {
      const source = {
        ...node(),
        buffer: null,
        detune: fakeParam(),
        stops: [] as number[],
        onended: null,
        start() {},
        stop(time: number) {
          this.stops.push(time);
        },
      };
      sources.push(source);
      return source;
    },
    createBiquadFilter: () => ({ ...node(), type: "", frequency: fakeParam(), Q: fakeParam() }),
    createGain: () => ({ ...node(), gain: fakeParam() }),
  };
  return { context: context as unknown as BaseAudioContext, sources };
}

const sample = { buffer: { duration: 3 }, offset: 0 } as unknown as GuitarSample;
const strike = (string: number, at: number) => ({
  string,
  midi: 40,
  at,
  velocity: 0.8,
  muted: false,
});

describe("voces por cuerda", () => {
  it("apaga la nota anterior de la misma cuerda al volver a tocarla", () => {
    const { context, sources } = fakeContext();
    const voices = new StringVoices(context, {} as AudioNode);
    voices.strike(strike(0, 0.1), sample, { ring: 2 });
    voices.strike(strike(0, 0.6), sample, { ring: 2 });
    // La primera recibe un segundo stop poco después de 0.6 s.
    expect(sources[0].stops.at(-1)).toBeGreaterThan(0.6);
    expect(sources[0].stops.at(-1)).toBeLessThan(0.75);
  });

  it("deja sonar las otras cuerdas", () => {
    const { context, sources } = fakeContext();
    const voices = new StringVoices(context, {} as AudioNode);
    voices.strike(strike(0, 0.1), sample, { ring: 2 });
    voices.strike(strike(5, 0.6), sample, { ring: 2 });
    expect(sources[0].stops).toHaveLength(1);
  });

  it("cancela lo programado para después sin tocar lo que ya suena", () => {
    const { context, sources } = fakeContext();
    const voices = new StringVoices(context, {} as AudioNode);
    voices.strike(strike(0, 0), sample, { ring: 2 });
    voices.strike(strike(1, 1), sample, { ring: 2 });
    voices.cancelAfter(0.5);
    expect(sources[0].stops).toHaveLength(1);
    expect(sources[1].stops.at(-1)).toBe(1);
  });

  it("suena más fuerte y más brillante con más intensidad", () => {
    expect(strikeGain(1, false)).toBeGreaterThan(strikeGain(0.5, false));
    expect(strikeBrightness(1, false)).toBeGreaterThan(strikeBrightness(0.5, false));
    expect(strikeGain(1, true)).toBeLessThan(strikeGain(1, false));
  });
});
