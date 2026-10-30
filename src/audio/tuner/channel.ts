export function needleX(cents: number, width: number): number {
  const clamped = Math.max(-50, Math.min(50, cents));
  return ((clamped + 50) / 100) * width;
}

export const ISOLATION_HEADERS = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
} as const;
