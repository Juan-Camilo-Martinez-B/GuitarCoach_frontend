export function needleX(cents: number, width: number): number {
  const clamped = Math.max(-50, Math.min(50, cents));
  return ((clamped + 50) / 100) * width;
}

export interface SampleChannel {
  kind: "shared" | "message";
  samples: Float32Array;
}

export function createSampleChannel(capacity: number, sharedAvailable: boolean): SampleChannel {
  if (sharedAvailable) {
    const buffer = new SharedArrayBuffer(capacity * Float32Array.BYTES_PER_ELEMENT);
    return { kind: "shared", samples: new Float32Array(buffer) };
  }
  return { kind: "message", samples: new Float32Array(capacity) };
}

export const ISOLATION_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
} as const;
