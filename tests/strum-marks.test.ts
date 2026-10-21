import { afterEach, describe, expect, it, vi } from "vitest";
import type { StrumHit } from "../src/domain/course";
import { queueStrumMarks } from "../src/ui/strumMarks";

const hits: StrumHit[] = [
  { at: 0, slot: 0, hit: 0, hold: 0.5 },
  { at: 0.5, slot: 0, hit: 1, hold: 0.25 },
];

describe("marcas del rasgueo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("enciende cada flecha y las apaga al terminar el último golpe", () => {
    vi.useFakeTimers();
    const marked: number[] = [];
    let cleared = false;
    queueStrumMarks(
      hits,
      (hit) => marked.push(hit.hit),
      () => {
        cleared = true;
      },
    );
    vi.advanceTimersByTime(0);
    expect(marked).toEqual([0]);
    expect(cleared).toBe(false);
    vi.advanceTimersByTime(500);
    expect(marked).toEqual([0, 1]);
    expect(cleared).toBe(false);
    vi.advanceTimersByTime(250);
    expect(cleared).toBe(true);
  });
});
