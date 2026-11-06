import { describe, expect, it } from "vitest";
import { shapeMidis } from "../src/audio/guitarTone";
import { localShape } from "../src/chords/shapes";
import { melodyForTitle, SONG_GUIDES } from "../src/domain/course";
import { LAMENTO_MELODY } from "../src/domain/lamentoMelody";

const guide = SONG_GUIDES["cancion-lamento"];

const CYCLE_CHORD_TONES: Record<string, number[]> = {
  Em: [4, 7, 11],
  Bm: [11, 2, 6],
  Am: [9, 0, 4],
  // Si7: Si, Re#, Fa# y La.
  B7: [11, 3, 6, 9],
};

describe("Lamento boliviano", () => {
  it("usa el tempo y el ciclo de ocho compases de la transcripción", () => {
    expect(guide.bpm).toBe(120);
    expect(guide.slots.map((slot) => [slot.symbol, slot.beats])).toEqual([
      ["Em", 8],
      ["Bm", 8],
      ["Am", 8],
      ["Em", 4],
      ["B7", 4],
    ]);
  });

  it("completa los cuatro tiempos con el rasgueo", () => {
    expect(guide.pattern.beats.reduce((sum, beats) => sum + beats, 0)).toBe(4);
  });

  it("toca Sim con cejilla, como en la transcripción", () => {
    const shape = localShape("Bm");
    expect(shape?.barre).toBe(2);
    expect(shape && shapeMidis(shape)).toEqual([42, 47, 54, 59, 62, 66]);
  });

  it("escribe la melodía en corcheas durante todo el ciclo", () => {
    expect(LAMENTO_MELODY).toHaveLength(64);
    expect(LAMENTO_MELODY.at(-1)).toMatchObject({ start: 31.5, beats: 0.5 });
  });

  it("solo toca notas del acorde que suena", () => {
    let origin = 0;
    for (const slot of guide.slots) {
      const tones = CYCLE_CHORD_TONES[slot.symbol];
      const notes = LAMENTO_MELODY.filter(
        (note) => note.start >= origin && note.start < origin + slot.beats,
      );
      expect(notes.length).toBeGreaterThan(0);
      expect(notes.filter((note) => !tones.includes(note.midi % 12))).toEqual([]);
      origin += slot.beats;
    }
  });

  it("entrega la melodía a Práctica solo para esta canción", () => {
    expect(melodyForTitle("Lamento boliviano")).toHaveLength(64);
    expect(melodyForTitle("Cambios abiertos")).toEqual([]);
  });
});
