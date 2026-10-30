import { describe, expect, it } from "vitest";
import { isChordSymbol } from "../src/domain/chart";
import {
  appendSection,
  barsFromText,
  barsToText,
  guideHits,
  removeSection,
  replaceSectionChords,
  songFromGuide,
  strumFromText,
  strumToText,
  totalBeats,
  type SongGuide,
} from "../src/domain/guide";

function sample(): SongGuide {
  return {
    version: 1,
    title: "Prueba",
    artist: "Ana",
    song_key: "G",
    bpm: 90,
    beats_per_bar: 4,
    capo: 0,
    sections: [
      { name: "Intro", start: 0, beats: 8, strum: { directions: ["abajo"], beats: [4] } },
      {
        name: "Coro",
        start: 8,
        beats: 4,
        strum: { directions: ["abajo", "arriba"], beats: [2, 2] },
      },
    ],
    chords: [
      { start: 0, beats: 4, chord: "G" },
      { start: 4, beats: 4, chord: "D" },
      { start: 8, beats: 2, chord: "Am" },
      { start: 10, beats: 2, chord: "C" },
    ],
    melody: [{ start: 9, beats: 1, midi: 69 }],
  };
}

describe("guía de canción", () => {
  it("toca cada compás con el rasgueo de su sección", () => {
    const hits = guideHits(sample());
    expect(hits.map((hit) => [hit.at, hit.chord, hit.direction])).toEqual([
      [0, 0, "abajo"],
      [4, 1, "abajo"],
      [8, 2, "abajo"],
      [10, 3, "arriba"],
    ]);
  });

  it("toca solo la sección elegida, contando desde su inicio", () => {
    const hits = guideHits(sample(), 8, 12);
    expect(hits.map((hit) => [hit.at, hit.chord, hit.section])).toEqual([
      [0, 2, 1],
      [2, 3, 1],
    ]);
  });

  it("escribe y vuelve a leer los compases de una sección", () => {
    const guide = sample();
    expect(barsToText(guide, guide.sections[0])).toBe("| G | D |");
    // Dos acordes iguales en el compás se escriben sin puntos.
    expect(barsToText(guide, guide.sections[1])).toBe("| Am C |");
    const expected = {
      chords: [
        { start: 8, beats: 2, chord: "Am" },
        { start: 10, beats: 2, chord: "C" },
      ],
      beats: 4,
    };
    expect(barsFromText("| Am C |", 8, 4, isChordSymbol)).toEqual(expected);
    expect(barsFromText("| Am . C . |", 8, 4, isChordSymbol)).toEqual(expected);
    // Un acorde corto al final sí necesita casilleros.
    expect(
      barsToText(
        {
          ...guide,
          chords: [
            { start: 0, beats: 3, chord: "G" },
            { start: 3, beats: 1, chord: "D" },
          ],
        },
        { ...guide.sections[0], beats: 4 },
      ),
    ).toBe("| G . . D |");
  });

  it("rechaza un acorde que no existe en el editor", () => {
    expect(() => barsFromText("| G | H7 |", 0, 4, isChordSymbol)).toThrow("H7");
  });

  it("lee y escribe el rasgueo en casilleros", () => {
    const strum = strumFromText("D-DU-UDU", 4);
    expect(strum.directions).toEqual(["abajo", "abajo", "arriba", "arriba", "abajo", "arriba"]);
    expect(strum.beats).toEqual([1, 0.5, 1, 0.5, 0.5, 0.5]);
    expect(strumToText(strum)).toBe("D-DU-UDU");
    expect(() => strumFromText("-DU", 4)).toThrow();
  });

  it("alarga una sección y corre lo que viene después", () => {
    const guide = sample();
    const { chords, beats } = barsFromText("| G | D | Em |", 0, 4, isChordSymbol);
    const next = replaceSectionChords(guide, 0, chords, beats);
    expect(next.sections[1].start).toBe(12);
    expect(next.chords.map((chord) => [chord.start, chord.chord])).toEqual([
      [0, "G"],
      [4, "D"],
      [8, "Em"],
      [12, "Am"],
      [14, "C"],
    ]);
    expect(next.melody[0].start).toBe(13);
  });

  it("quita una sección y adelanta la siguiente", () => {
    const next = removeSection(sample(), 0);
    expect(next.sections).toHaveLength(1);
    expect(next.sections[0].start).toBe(0);
    expect(next.chords.map((chord) => chord.start)).toEqual([0, 2]);
    expect(() => removeSection(next, 0)).toThrow();
  });

  it("agrega una sección de un compás al final", () => {
    const next = appendSection(sample(), "Final");
    expect(next.sections.at(-1)).toMatchObject({ name: "Final", start: 12, beats: 4 });
    expect(totalBeats(next)).toBe(16);
  });

  it("arma la canción plana para la práctica con compás y pulso desde uno", () => {
    const song = songFromGuide({
      id: "g1",
      songId: 7,
      title: "Prueba",
      artist: "Ana",
      bpm: 90,
      sourceKind: "pegado",
      status: "borrador",
      updatedAt: "",
      guide: sample(),
    });
    expect(song?.id).toBe(7);
    expect(song?.chords.slice(2)).toEqual([
      { bar: 3, beat: 1, chord: "Am" },
      { bar: 3, beat: 3, chord: "C" },
    ]);
  });
});
