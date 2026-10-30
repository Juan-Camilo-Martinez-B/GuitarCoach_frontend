import { parseChord } from "../../domain/chart";

const PITCH: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

// Intervalos desde la fundamental para cada cualidad que acepta la API.
const INTERVALS: Record<string, number[]> = {
  maj: [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 2],
  m7b5: [0, 3, 6, 10],
  m6: [0, 3, 7, 9],
  m9: [0, 3, 7, 10, 2],
  "6": [0, 4, 7, 9],
  "9": [0, 4, 7, 10, 2],
  add9: [0, 4, 7, 2],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7sus4": [0, 5, 7, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
};

// La fundamental pesa más: en la guitarra suele ser la cuerda más grave y la que más suena.
const ROOT_WEIGHT = 1.4;

export function rootPitch(symbol: string): number {
  const root = PITCH[parseChord(symbol).root];
  if (root === undefined) {
    throw new Error(`Raíz desconocida: ${symbol}`);
  }
  return root;
}

export function templateFor(symbol: string): Float32Array {
  const parsed = parseChord(symbol);
  const root = rootPitch(symbol);
  const intervals = INTERVALS[parsed.quality] ?? INTERVALS.maj;
  const vector = new Float32Array(12);
  for (const interval of intervals) {
    vector[(root + interval) % 12] = interval === 0 ? ROOT_WEIGHT : 1;
  }
  return vector;
}

export function cosine(left: Float32Array, right: Float32Array): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }
  return dot / Math.sqrt(leftNorm * rightNorm);
}

export function bestChord(frame: Float32Array, candidates: string[]): string | null {
  let winner: string | null = null;
  let score = 0.5;
  for (const candidate of candidates) {
    const value = cosine(frame, templateFor(candidate));
    if (value > score) {
      winner = candidate;
      score = value;
    }
  }
  return winner;
}

export function vote(frames: Array<string | null>): string | null {
  const counts = new Map<string, number>();
  for (const frame of frames) {
    if (!frame) {
      continue;
    }
    counts.set(frame, (counts.get(frame) ?? 0) + 1);
  }
  let winner: string | null = null;
  let max = 0;
  for (const [chord, count] of counts) {
    if (count > max) {
      winner = chord;
      max = count;
    }
  }
  return winner;
}
