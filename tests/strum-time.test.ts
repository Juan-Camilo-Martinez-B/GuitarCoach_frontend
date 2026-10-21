import { describe, expect, it } from "vitest";
import { STRUM_ABIERTOS, STRUM_BASICO, STRUM_MENORES, strumHits } from "../src/domain/course";

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

  it("usa cuatro golpes iguales en el rasgueo básico", () => {
    const hits = strumHits([4], 60, STRUM_BASICO);
    expect(hits.map((hit) => hit.at)).toEqual([0, 1, 2, 3]);
    expect(hits.map((hit) => hit.hold)).toEqual([1, 1, 1, 1]);
  });

  it("alarga el golpe de abajo en cambios abiertos", () => {
    const hits = strumHits([4], 60, STRUM_ABIERTOS);
    expect(hits.map((hit) => hit.at)).toEqual([0, 1.5, 2, 3.5]);
    expect(hits.map((hit) => hit.hold)).toEqual([1.5, 0.5, 1.5, 0.5]);
  });

  it("sostiene el primer golpe de la ronda de menores", () => {
    const hits = strumHits([4], 60, STRUM_MENORES);
    expect(hits.map((hit) => hit.at)).toEqual([0, 2, 3]);
    expect(hits.map((hit) => hit.hold)).toEqual([2, 1, 1]);
  });
});
