export const DEFAULT_HIT_WINDOW_MS = 150;

export type HitKind = "hit" | "miss";

export function judgeHit(
  expected: string,
  detected: string | null,
  deltaMs: number,
  windowMs = DEFAULT_HIT_WINDOW_MS,
): HitKind {
  if (detected !== expected || Math.abs(deltaMs) > windowMs) {
    return "miss";
  }
  return "hit";
}
