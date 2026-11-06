import { rms } from "./gate";
import { hannSpectrum } from "./fft";
import { cosine, templateFor } from "./chordTemplates";
import { midiFromFrequency } from "./noteMath";

const LOWEST_HZ = 70;
const HIGHEST_HZ = 1400;
const SILENCE_RMS = 0.01;
const MIN_SCORE = 0.6;
// El acorde esperado gana si queda a menos de este margen del mejor candidato.
const TOLERANCE = 0.04;
// Un pico a menos de esta fracción del mayor es ruido o resto de la sala.
const PEAK_FLOOR = 0.02;
// Una guitarra rara vez está exacta: se tolera este corrimiento común, en semitonos.
const MAX_TUNING_DRIFT = 0.45;
const TRIADS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].flatMap((root) => [
  root,
  `${root}m`,
]);

export interface ChordJudgement {
  heard: string | null;
  ok: boolean;
  score: number;
}

interface SpectralPeak {
  midi: number;
  weight: number;
}

/** Los picos del espectro con su frecuencia interpolada: más precisa que la banda de la FFT. */
function spectralPeaks(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
): SpectralPeak[] {
  const low = Math.max(1, Math.floor((LOWEST_HZ * fftSize) / sampleRate));
  const high = Math.min(magnitudes.length - 2, Math.ceil((HIGHEST_HZ * fftSize) / sampleRate));
  let top = 0;
  for (let bin = low; bin <= high; bin += 1) {
    top = Math.max(top, magnitudes[bin]);
  }
  if (top <= 0) {
    return [];
  }
  const floor = top * PEAK_FLOOR;
  const peaks: SpectralPeak[] = [];
  for (let bin = low; bin <= high; bin += 1) {
    const value = magnitudes[bin];
    if (value < floor || value < magnitudes[bin - 1] || value <= magnitudes[bin + 1]) {
      continue;
    }
    const left = Math.log(magnitudes[bin - 1] + 1e-9);
    const center = Math.log(value + 1e-9);
    const right = Math.log(magnitudes[bin + 1] + 1e-9);
    const denominator = left - 2 * center + right;
    const shift = denominator === 0 ? 0 : (0.5 * (left - right)) / denominator;
    const frequency = ((bin + shift) * sampleRate) / fftSize;
    peaks.push({ midi: midiFromFrequency(frequency), weight: Math.sqrt(value) });
  }
  return peaks;
}

/** El corrimiento común de los picos respecto de las notas exactas: la afinación de la guitarra. */
function tuningDrift(peaks: SpectralPeak[]): number {
  let sine = 0;
  let cosineSum = 0;
  for (const peak of peaks) {
    const angle = 2 * Math.PI * (peak.midi - Math.round(peak.midi));
    sine += peak.weight * Math.sin(angle);
    cosineSum += peak.weight * Math.cos(angle);
  }
  const drift = Math.atan2(sine, cosineSum) / (2 * Math.PI);
  return Math.abs(drift) > MAX_TUNING_DRIFT ? 0 : drift;
}

/** Croma de un espectro: cada pico suma a su nota según lo cerca que esté de ella. */
export function chromaFromSpectrum(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
): Float32Array | null {
  const peaks = spectralPeaks(magnitudes, sampleRate, fftSize);
  if (peaks.length === 0) {
    return null;
  }
  const drift = tuningDrift(peaks);
  const bins = new Float32Array(12);
  for (const peak of peaks) {
    const corrected = peak.midi - drift;
    const nearest = Math.round(corrected);
    const closeness = Math.cos((Math.PI / 2) * Math.min(1, Math.abs(corrected - nearest) * 2));
    bins[((nearest % 12) + 12) % 12] += peak.weight * closeness * closeness;
  }
  const largest = Math.max(...bins);
  return largest > 0 ? bins.map((value) => value / largest) : null;
}

/** Croma del tramo: ventana de Hann, solo el registro de la guitarra y compresión suave. */
export function chordFrame(samples: Float32Array, sampleRate: number): Float32Array | null {
  if (rms(samples) < SILENCE_RMS) {
    return null;
  }
  return chromaFromSpectrum(hannSpectrum(samples), sampleRate, samples.length);
}

/** El acorde esperado, los de la canción y todas las tríadas, sin repetir. */
export function chordCandidates(expected: string, songChords: string[] = []): string[] {
  return [...new Set([expected, ...songChords, ...TRIADS])];
}

export function scoreCandidates(frame: Float32Array, candidates: string[]): Map<string, number> {
  return new Map(
    candidates.map((candidate) => [candidate, cosine(frame, templateFor(candidate))] as const),
  );
}

/** El veredicto a partir de los puntajes de cada candidato, de un tramo o de varios. */
export function decideChord(scores: Map<string, number>, expected: string): ChordJudgement {
  let heard: string | null = null;
  let best = 0;
  for (const [candidate, score] of scores) {
    if (score > best) {
      best = score;
      heard = candidate;
    }
  }
  if (best < MIN_SCORE) {
    return { heard: null, ok: false, score: best };
  }
  const expectedScore = scores.get(expected) ?? 0;
  const ok = expectedScore >= MIN_SCORE && expectedScore >= best - TOLERANCE;
  return { heard: ok ? expected : heard, ok, score: ok ? expectedScore : best };
}

export function judgeChord(
  frame: Float32Array,
  expected: string,
  candidates: string[],
): ChordJudgement {
  return decideChord(scoreCandidates(frame, candidates), expected);
}
