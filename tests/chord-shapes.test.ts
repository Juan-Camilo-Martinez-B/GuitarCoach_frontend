import { describe, expect, it } from "vitest";
import { chordQuery, localShape, placeNote, voicing } from "../src/chords/shapes";

describe("diagramas de acordes", () => {
  it("arma Mim como la carta abierta y calcula sus notas", () => {
    const chord = localShape("Mim");
    expect(chord?.frets).toEqual([0, 2, 2, 0, 0, 0]);
    expect(chord ? voicing(chord) : []).toEqual([40, 47, 52, 55, 59, 64]);
  });

  it("pone la cejilla de Fa en el traste 1", () => {
    expect(localShape("F")?.barre).toBe(1);
  });

  it("coloca Do en la cuerda 2, traste 1", () => {
    expect(placeNote("Do")).toEqual({ string: 2, fret: 1, midi: 60 });
  });

  it("pide el menor de mi a la base pública", () => {
    expect(chordQuery("Em")).toEqual({ key: "E", suffix: "minor" });
  });
});
