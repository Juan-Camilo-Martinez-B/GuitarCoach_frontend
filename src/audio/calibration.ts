export function latencyOffset(tapsMs: number[], beatsMs: number[]): number {
  const count = Math.min(tapsMs.length, beatsMs.length);
  if (count === 0) {
    return 0;
  }
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    sum += tapsMs[index] - beatsMs[index];
  }
  return Math.round(sum / count);
}
