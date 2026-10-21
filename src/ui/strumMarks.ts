import type { StrumHit } from "../domain/course";

export function queueStrumMarks(
  hits: StrumHit[],
  mark: (hit: StrumHit) => void,
  clear: () => void,
): number[] {
  const timers = hits.map((hit) => globalThis.setTimeout(() => mark(hit), hit.at * 1000));
  const end = hits.reduce((latest, hit) => Math.max(latest, hit.at + hit.hold), 0);
  timers.push(globalThis.setTimeout(clear, end * 1000));
  return timers;
}
