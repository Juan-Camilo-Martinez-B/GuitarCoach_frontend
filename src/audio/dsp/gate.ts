export function rms(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0;
  }
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples.length);
}

export function applyGate(samples: Float32Array, threshold: number): Float32Array {
  if (rms(samples) < threshold) {
    return new Float32Array(samples.length);
  }
  return samples;
}
