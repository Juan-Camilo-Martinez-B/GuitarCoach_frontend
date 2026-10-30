import { rms } from "./gate";
import { fftMagnitudes } from "./fft";
import { midiFromFrequency } from "./noteMath";
import { cosine, templateFor } from "./chordTemplates";

const LOWEST_HZ = 70;
const HIGHEST_HZ = 1400;
const SILENCE_RMS = 0.01;
const MIN_SCORE = 0.6;
// El acorde esperado gana si queda a menos de este margen del mejor candidato.
const TOLERANCE = 0.04;
const TRIADS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].flatMap((root) => [
  root,
  `${root}m`,
]);

export interface ChordJudgement {
  heard: string | null;
  ok: boolean;
  score: number;
}

/** Croma del tramo: ventana de Hann, solo el registro de la guitarra y compresión suave. */
export function chordFrame(samples: Float32Array, sampleRate: number): Float32Array | null {
  if (rms(samples) < SILENCE_RMS) {
    return null;
  }
  const size = samples.length;
  const windowed = new Float32Array(size);
  for (let index = 0; index < size; index += 1) {
    windowed[index] = samples[index] * (0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (size - 1)));
  }
  const magnitudes = fftMagnitudes(windowed);
  const bins = new Float32Array(12);
  for (let index = 1; index < magnitudes.length; index += 1) {
    const frequency = (index * sampleRate) / size;
    if (frequency < LOWEST_HZ || frequency > HIGHEST_HZ) {
      continue;
    }
    const pitch = ((Math.round(midiFromFrequency(frequency)) % 12) + 12) % 12;
    bins[pitch] += Math.sqrt(magnitudes[index]);
  }
  const peak = Math.max(...bins);
  if (peak <= 0) {
    return null;
  }
  return bins.map((value) => value / peak);
}

/** El acorde esperado, los de la canción y todas las tríadas, sin repetir. */
export function chordCandidates(expected: string, songChords: string[] = []): string[] {
  return [...new Set([expected, ...songChords, ...TRIADS])];
}

export function judgeChord(
  frame: Float32Array,
  expected: string,
  candidates: string[],
): ChordJudgement {
  let heard: string | null = null;
  let best = 0;
  let expectedScore = 0;
  for (const candidate of candidates) {
    const score = cosine(frame, templateFor(candidate));
    if (candidate === expected) {
      expectedScore = score;
    }
    if (score > best) {
      best = score;
      heard = candidate;
    }
  }
  if (best < MIN_SCORE) {
    return { heard: null, ok: false, score: best };
  }
  const ok = expectedScore >= MIN_SCORE && expectedScore >= best - TOLERANCE;
  return { heard: ok ? expected : heard, ok, score: ok ? expectedScore : best };
}
