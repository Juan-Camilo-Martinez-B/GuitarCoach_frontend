import { describe, expect, it } from "vitest";
import type { GuideChord, SongGuide } from "../src/domain/guide";
import {
  inferPartMarks,
  prettifySectionName,
  sectionLabelFromText,
  withNamedParts,
} from "../src/tab/songParts";

function bars(symbols: string[]): GuideChord[] {
  const chords: GuideChord[] = [];
  symbols.forEach((symbol, index) => {
    const previous = chords.at(-1);
    if (previous?.chord === symbol) {
      previous.beats += 4;
      return;
    }
    chords.push({ start: index * 4, beats: 4, chord: symbol });
  });
  return chords;
}

describe("partes de una canción nueva", () => {
  it("traduce las marcas del archivo", () => {
    expect(prettifySectionName("Verse 1")).toBe("Verso 1");
    expect(prettifySectionName("CHORUS")).toBe("Coro");
    expect(prettifySectionName("Estribillo")).toBe("Coro");
    expect(sectionLabelFromText("Verso 2")).toBe("Verso 2");
    expect(sectionLabelFromText("cuando la luz se apaga")).toBeNull();
  });

  it("separa el verso del coro cuando la progresión se repite", () => {
    const symbols = [
      "Am",
      "G",
      "C",
      "F",
      "Am",
      "G",
      "C",
      "F",
      "C",
      "G",
      "Am",
      "F",
      "C",
      "G",
      "Am",
      "F",
    ];
    const marks = inferPartMarks(bars(symbols), symbols.length * 4, 4);
    expect(marks.map((mark) => mark.name)).toEqual(["Verso 1", "Verso 2", "Coro 1", "Coro 2"]);
    expect(marks.map((mark) => mark.start)).toEqual([0, 16, 32, 48]);
  });

  it("deja la intro corta aparte y no parte una canción de un solo acorde", () => {
    const withIntro = ["Dm", "Dm", "Am", "G", "C", "F", "Am", "G", "C", "F"];
    const marks = inferPartMarks(bars(withIntro), withIntro.length * 4, 4);
    expect(marks.map((mark) => mark.name)).toEqual(["Intro", "Verso 1", "Verso 2"]);

    expect(inferPartMarks(bars(["Am", "Am", "Am", "Am"]), 16, 4)).toEqual([
      { start: 0, name: "Canción" },
    ]);
  });

  it("renombra las partes genéricas de una guía ya guardada", () => {
    const symbols = [
      "Am",
      "G",
      "C",
      "F",
      "Am",
      "G",
      "C",
      "F",
      "C",
      "G",
      "Am",
      "F",
      "C",
      "G",
      "Am",
      "F",
    ];
    const strum = { directions: ["abajo" as const], beats: [1] };
    const guide: SongGuide = {
      version: 2,
      title: "Música ligera",
      artist: "Tablatura",
      song_key: null,
      bpm: 120,
      beats_per_bar: 4,
      capo: 0,
      sections: [
        { name: "Parte 1", start: 0, beats: 32, strum },
        { name: "Parte 2", start: 32, beats: 32, strum },
      ],
      chords: bars(symbols),
      melody: [],
    };
    expect(withNamedParts(guide).sections.map((section) => section.name)).toEqual([
      "Verso 1",
      "Verso 2",
      "Coro 1",
      "Coro 2",
    ]);
    const kept = { ...guide, sections: [{ name: "Coro", start: 0, beats: 64, strum }] };
    expect(withNamedParts(kept).sections[0].name).toBe("Coro");
  });
});
