import { describe, expect, it } from "vitest";
import { nearestString, readingMidi, tuningAdvice } from "../src/audio/tuner/strings";

describe("cuerda objetivo del afinador", () => {
  it("convierte la lectura en una nota MIDI con decimales", () => {
    expect(readingMidi({ name: "A", octave: 2, cents: -20 })).toBeCloseTo(44.8);
  });

  it("mide los cents contra la cuerda, no contra el semitono más cercano", () => {
    // Un La muy grave, casi en Sol#: sigue siendo la quinta cuerda.
    const target = nearestString(44.2);
    expect(target.string.number).toBe(5);
    expect(target.cents).toBe(-80);
  });

  it("elige la sexta para un Mi grave apenas alto", () => {
    expect(nearestString(40.1)).toMatchObject({ string: { number: 6 }, cents: 10 });
  });

  it("dice si hay que tensar, aflojar o si ya está", () => {
    expect(tuningAdvice(-12).kind).toBe("subir");
    expect(tuningAdvice(9).kind).toBe("bajar");
    expect(tuningAdvice(3).kind).toBe("afinada");
  });
});
