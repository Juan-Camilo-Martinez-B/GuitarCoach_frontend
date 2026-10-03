import { midiFromFrequency } from "./noteMath";

export function chroma(magnitudes: Float32Array, sampleRate: number): Float32Array {
  const bins = new Float32Array(12);
  const fullSize = magnitudes.length * 2;
  for (let index = 1; index < magnitudes.length; index += 1) {
    const frequency = (index * sampleRate) / fullSize;
    if (frequency < 20) {
      continue;
    }
    const pitch = ((Math.round(midiFromFrequency(frequency)) % 12) + 12) % 12;
    bins[pitch] += magnitudes[index];
  }
  const peak = Math.max(...bins, 1e-9);
  for (let index = 0; index < bins.length; index += 1) {
    bins[index] /= peak;
  }
  return bins;
}
