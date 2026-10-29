import { describe, expect, it } from "vitest";
import { seededRandom } from "../src/audio/guitar/random";
import {
  accentFor,
  performStrum,
  strumSpread,
  type StringNote,
} from "../src/audio/guitar/strumPerformer";

// Mim: las seis cuerdas suenan.
const EM: StringNote[] = [40, 47, 52, 55, 59, 64].map((midi, string) => ({ string, midi }));

describe("intérprete del rasgueo", () => {
  it("baja de la sexta a la primera, en orden y sin empezar antes del golpe", () => {
    const strikes = performStrum(
      { notes: EM, direction: "abajo", at: 1, velocity: 0.8, quarter: 0.5 },
      seededRandom(1),
    );
    expect(strikes.map((strike) => strike.string)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(strikes[0].at).toBe(1);
    for (let index = 1; index < strikes.length; index += 1) {
      expect(strikes[index].at).toBeGreaterThan(strikes[index - 1].at);
    }
  });

  it("hacia arriba toca solo las cuatro agudas, de la primera a la cuarta, y más suave", () => {
    const random = seededRandom(2);
    const down = performStrum(
      { notes: EM, direction: "abajo", at: 0, velocity: 0.8, quarter: 0.5 },
      random,
    );
    const up = performStrum(
      { notes: EM, direction: "arriba", at: 0, velocity: 0.8, quarter: 0.5 },
      random,
    );
    expect(up.map((strike) => strike.string)).toEqual([5, 4, 3, 2]);
    expect(Math.max(...up.map((strike) => strike.velocity))).toBeLessThan(
      Math.max(...down.map((strike) => strike.velocity)),
    );
  });

  it("marca el golpe apagado como sin nota", () => {
    const strikes = performStrum(
      { notes: EM, direction: "apagado", at: 0, velocity: 0.8, quarter: 0.5 },
      seededRandom(3),
    );
    expect(strikes.every((strike) => strike.muted)).toBe(true);
  });

  it("repite el mismo rasgueo con la misma semilla", () => {
    const request = { notes: EM, direction: "abajo" as const, at: 0, velocity: 0.7, quarter: 0.6 };
    expect(performStrum(request, seededRandom(9))).toEqual(performStrum(request, seededRandom(9)));
  });

  it("cruza las cuerdas más rápido a tempo alto", () => {
    expect(strumSpread(0.8, 60 / 140)).toBeLessThan(strumSpread(0.8, 60 / 70));
  });

  it("acentúa el primer tiempo y deja más suaves los contratiempos", () => {
    expect(accentFor(0)).toBeGreaterThan(accentFor(2));
    expect(accentFor(2)).toBeGreaterThan(accentFor(1));
    expect(accentFor(1)).toBeGreaterThan(accentFor(1.5));
    expect(accentFor(4)).toBe(accentFor(0));
  });
});
