export function sineWave(frequency: number, sampleRate: number, length: number): Float32Array {
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    samples[index] = Math.sin((2 * Math.PI * frequency * index) / sampleRate);
  }
  return samples;
}

export function yinPitch(
  samples: Float32Array,
  sampleRate: number,
  threshold = 0.15,
): number | null {
  const half = Math.floor(samples.length / 2);
  const difference = new Float32Array(half);
  for (let tau = 0; tau < half; tau += 1) {
    let sum = 0;
    for (let index = 0; index < half; index += 1) {
      const delta = samples[index] - samples[index + tau];
      sum += delta * delta;
    }
    difference[tau] = sum;
  }
  const cmndf = new Float32Array(half);
  cmndf[0] = 1;
  let running = 0;
  for (let tau = 1; tau < half; tau += 1) {
    running += difference[tau];
    cmndf[tau] = running === 0 ? 1 : (difference[tau] * tau) / running;
  }
  const minTau = Math.max(2, Math.floor(sampleRate / 1000));
  for (let tau = minTau; tau < half - 1; tau += 1) {
    if (cmndf[tau] >= threshold) {
      continue;
    }
    let best = tau;
    while (best + 1 < half && cmndf[best + 1] < cmndf[best]) {
      best += 1;
    }
    const previous = cmndf[best - 1] ?? cmndf[best];
    const next = cmndf[best + 1] ?? cmndf[best];
    const denominator = 2 * (2 * cmndf[best] - next - previous);
    const shift = denominator === 0 ? 0 : (next - previous) / denominator;
    return sampleRate / (best + shift);
  }
  return null;
}
