import { describe, expect, it } from "vitest";
import { chordCandidates } from "../src/audio/dsp/chordRecognizer";
import { GuitarListener, type ListenerEvent } from "../src/audio/listening/guitarListener";
import { ChordScoreFollower, MelodyFollower } from "../src/audio/listening/scoreFollower";

const RATE = 44100;
const SHAPES: Record<string, number[]> = {
  G: [43, 47, 50, 55, 59, 67],
  D: [50, 57, 62, 66],
  Em: [40, 47, 52, 55, 59, 64],
  C: [48, 52, 55, 60, 64],
};

/** Una cuerda pulsada aproximada: armónicos que decaen y ruido del ataque. */
function pluck(out: Float32Array, midi: number, at: number, length: number, gain = 0.12) {
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const start = Math.round(at * RATE);
  const stop = Math.min(out.length, start + Math.round(length * RATE));
  for (let index = start; index < stop; index += 1) {
    const time = (index - start) / RATE;
    let value = 0;
    for (let harmonic = 1; harmonic <= 6; harmonic += 1) {
      const decay = Math.exp(-time * (1.5 + harmonic * 0.8));
      value += (decay / harmonic) * Math.sin(2 * Math.PI * frequency * harmonic * time);
    }
    out[index] += gain * value;
  }
}

function listen(samples: Float32Array, options = { chords: true, notes: false }): ListenerEvent[] {
  const events: ListenerEvent[] = [];
  const listener = new GuitarListener(RATE, (event) => events.push(event), options);
  for (let start = 0; start < samples.length; start += 128) {
    listener.feed(samples.subarray(start, start + 128), start === 0 ? 0 : start);
  }
  return events;
}

describe("oyente de guitarra", () => {
  it("encuentra cada ataque a su tiempo, incluso a 240 BPM", () => {
    const beat = 60 / 240;
    const samples = new Float32Array(RATE * 3);
    const times = Array.from({ length: 8 }, (_, index) => 0.3 + index * beat);
    times.forEach((at) => SHAPES.C.forEach((midi) => pluck(samples, midi, at, beat * 0.95)));
    const onsets = listen(samples).flatMap((event) => (event.type === "onset" ? [event.at] : []));
    expect(onsets).toHaveLength(times.length);
    onsets.forEach((onset, index) => {
      expect(Math.abs(onset - times[index])).toBeLessThan(0.03);
    });
  });

  it("guarda el instante del reloj de audio aunque el primer bloque no empiece en cero", () => {
    const samples = new Float32Array(RATE);
    SHAPES.G.forEach((midi) => pluck(samples, midi, 0.2, 0.5));
    const events: ListenerEvent[] = [];
    const listener = new GuitarListener(RATE, (event) => events.push(event));
    const offset = RATE * 10;
    for (let start = 0; start < samples.length; start += 128) {
      listener.feed(samples.subarray(start, start + 128), offset + start);
    }
    const onset = events.find((event) => event.type === "onset");
    expect(onset?.type === "onset" ? onset.at : 0).toBeCloseTo(10.2, 1);
  });

  it("no inventa ataques en silencio ni con un ruido de fondo parejo", () => {
    const samples = new Float32Array(RATE * 2);
    let seed = 7;
    for (let index = 0; index < samples.length; index += 1) {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      samples[index] = ((seed / 4294967296) * 2 - 1) * 0.002;
    }
    expect(listen(samples)).toHaveLength(0);
  });

  it("reparte los acordes rápidos entre sus tramos y reconoce la progresión", () => {
    const progression = ["G", "D", "Em", "C", "G", "D", "Em", "C"];
    const length = 60 / 200;
    const samples = new Float32Array(RATE * 4);
    progression.forEach((symbol, index) => {
      SHAPES[symbol].forEach((midi) => pluck(samples, midi, 0.3 + index * length, length * 0.9));
    });
    const follower = new ChordScoreFollower(
      progression.map((symbol, index) => ({
        symbol,
        at: 0.3 + index * length,
        end: 0.3 + (index + 1) * length,
      })),
      (symbol) => chordCandidates(symbol, progression),
    );
    for (const event of listen(samples)) {
      if (event.type === "onset") {
        follower.addOnset(event.at);
      } else if (event.type === "chord") {
        follower.addChroma(event.onsetAt, event.at, event.windowSize, event.chroma);
      }
    }
    progression.forEach((symbol, index) => {
      const result = follower.result(index);
      expect(result.judgement.ok, `${symbol} en el tramo ${index}`).toBe(true);
      expect(Math.abs(result.deltaMs ?? 999)).toBeLessThan(40);
    });
  });

  it("nombra las notas de una melodía rápida", () => {
    const melody = [55, 57, 59, 60, 62, 64, 66, 67];
    const step = 60 / 200 / 2;
    const samples = new Float32Array(RATE * 2);
    melody.forEach((midi, index) => pluck(samples, midi, 0.3 + index * step, step * 0.95, 0.3));
    const notes = listen(samples, { chords: false, notes: true }).flatMap((event) =>
      event.type === "note" ? [event.midi] : [],
    );
    const follower = new MelodyFollower(melody);
    notes.forEach((midi) => follower.hear(midi));
    expect(follower.accuracy()).toBeGreaterThanOrEqual(85);
  });

  it("nota un ligado aunque no haya ataque nuevo", () => {
    const samples = new Float32Array(RATE);
    const low = 440 * 2 ** ((55 - 69) / 12);
    const high = 440 * 2 ** ((57 - 69) / 12);
    let phase = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const time = index / RATE;
      const frequency = time < 0.5 ? low : high;
      phase += (2 * Math.PI * frequency) / RATE;
      samples[index] = time < 0.1 ? 0 : 0.3 * Math.sin(phase);
    }
    const notes = listen(samples, { chords: false, notes: true }).flatMap((event) =>
      event.type === "note" ? [event.midi] : [],
    );
    expect(notes[0]).toBe(55);
    expect(notes).toContain(57);
  });
});

describe("seguimiento de la melodía", () => {
  it("avanza con las notas correctas y marca las que faltan", () => {
    const follower = new MelodyFollower([60, 62, 64, 65, 67]);
    expect(follower.hear(60).matched).toBe(true);
    expect(follower.hear(70).matched).toBe(false);
    const skipped = follower.hear(64);
    expect(skipped.marks).toEqual(["bien", "saltada", "bien"]);
    expect(skipped.position).toBe(3);
  });

  it("acepta la misma nota en otra octava", () => {
    const follower = new MelodyFollower([60]);
    expect(follower.hear(72).matched).toBe(true);
    expect(follower.done).toBe(true);
    expect(follower.accuracy()).toBe(100);
  });
});
