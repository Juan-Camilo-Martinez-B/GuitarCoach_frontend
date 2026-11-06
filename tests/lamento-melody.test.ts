import { describe, expect, it } from "vitest";
import { shapeMidis } from "../src/audio/guitarTone";
import { localShape } from "../src/chords/shapes";
import { melodyForTitle, SONG_GUIDES } from "../src/domain/course";
import { LAMENTO_MELODY } from "../src/domain/lamentoMelody";

const guide = SONG_GUIDES["cancion-lamento"];

const CYCLE_CHORD_TONES: Record<string, number[]> = {
  Am: [9, 0, 4],
  Em: [4, 7, 11],
  Dm: [2, 5, 9],
  // Mi7: Mi, Sol#, Si y Re.
  E7: [4, 8, 11, 2],
};

describe("Lamento boliviano", () => {
  it("usa el tempo de la transcripción y su ciclo de ocho compases en La menor", () => {
    expect(guide.bpm).toBe(120);
    expect(guide.slots.map((slot) => [slot.symbol, slot.beats])).toEqual([
      ["Am", 8],
      ["Em", 8],
      ["Dm", 8],
      ["Am", 4],
      ["E7", 4],
    ]);
  });

  it("completa los cuatro tiempos con el rasgueo", () => {
    expect(guide.pattern.beats.reduce((sum, beats) => sum + beats, 0)).toBe(4);
  });

  it("solo pide acordes abiertos, sin cejilla", () => {
    for (const slot of guide.slots) {
      expect(localShape(slot.symbol)?.barre ?? null).toBeNull();
    }
    const seventh = localShape("E7");
    expect(seventh && shapeMidis(seventh)).toEqual([40, 47, 50, 56, 59, 64]);
  });

  it("deja la melodía al alcance de los primeros trastes", () => {
    const pitches = LAMENTO_MELODY.map((note) => note.midi);
    expect(Math.min(...pitches)).toBeGreaterThanOrEqual(48);
    expect(Math.max(...pitches)).toBeLessThanOrEqual(59);
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
