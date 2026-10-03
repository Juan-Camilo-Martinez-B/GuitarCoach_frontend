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

export function templateFor(symbol: string): Float32Array {
  const parsed = parseChord(symbol);
  const root = PITCH[parsed.root];
  if (root === undefined) {
    throw new Error(`Raíz desconocida: ${parsed.root}`);
  }
  const minor = parsed.quality.startsWith("m") && !parsed.quality.startsWith("maj");
  const intervals = minor ? [0, 3, 7] : [0, 4, 7];
  const vector = new Float32Array(12);
  for (const interval of intervals) {
    vector[(root + interval) % 12] = 1;
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
