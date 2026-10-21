import { describe, expect, it } from "vitest";
import { strumHits } from "../src/domain/course";

describe("rasgueo en el compás", () => {
  it("alarga solo el primer golpe", () => {
    const hits = strumHits([4], 120);
    expect(hits.map((hit) => hit.at)).toEqual([0, 0.5, 0.75, 1, 1.25, 1.5]);
    expect(hits.map((hit) => hit.hold)).toEqual([0.5, 0.25, 0.25, 0.25, 0.25, 0.25]);
  });

  it("parte el último compás de Lamento entre Mim y Si7", () => {
    const hits = strumHits([4, 4, 4, 2, 2], 120);
    expect(hits.filter((hit) => hit.slot === 3).map((hit) => hit.hit)).toEqual([0, 1, 2]);
    expect(hits.filter((hit) => hit.slot === 4).map((hit) => hit.hit)).toEqual([3, 4, 5]);
    expect(hits.at(-1)?.at).toBe(7.5);
  });
});
