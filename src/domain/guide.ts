import type { StrumDirection, StrumPattern } from "./course";
import type { Song } from "./types";

/** El tiempo se cuenta en pulsos de negra desde el inicio de la canción; el primero es 0. */
export interface GuideChord {
  start: number;
  beats: number;
  chord: string;
}

export interface GuideNote {
  start: number;
  beats: number;
  midi: number;
}

export interface GuideSection {
  name: string;
  start: number;
  beats: number;
  strum: { directions: StrumDirection[]; beats: number[] };
}

export interface SongGuide {
  version: number;
  title: string;
  artist: string;
  song_key: string | null;
  bpm: number;
  beats_per_bar: number;
  capo: number;
  sections: GuideSection[];
  chords: GuideChord[];
  melody: GuideNote[];
}

export type GuideStatus = "borrador" | "revisada";

export interface GuideSummary {
  id: string;
  songId: number | null;
  title: string;
  artist: string;
  bpm: number;
  sourceKind: string;
  status: GuideStatus;
  updatedAt: string;
}

export interface GuideRecord extends GuideSummary {
  guide: SongGuide;
}

export const SOURCE_LABEL: Record<string, string> = {
  pegado: "Texto pegado",
  chordpro: "ChordPro",
  musicxml: "MusicXML",
  audio: "Audio",
  editor: "Editor",
};

/** Un golpe de rasgueo de la guía, en pulsos. */
export interface GuideHit {
  at: number;
  hold: number;
  chord: number;
  section: number;
  hit: number;
  direction: StrumDirection;
}

const EPSILON = 1e-6;

export function sectionPattern(section: GuideSection, hint = ""): StrumPattern {
  return { directions: section.strum.directions, beats: section.strum.beats, hint };
}

function chordAt(guide: SongGuide, beat: number): number {
  let found = -1;
  guide.chords.forEach((chord, index) => {
    if (chord.start <= beat + EPSILON && beat < chord.start + chord.beats - EPSILON) {
      found = index;
    }
  });
  return found;
}

/**
 * Golpes entre from y to: cada compás repite el rasgueo de su sección, y un cambio de acorde
 * a mitad del compás entra en el golpe que cae sobre él.
 */
export function guideHits(guide: SongGuide, from = 0, to = totalBeats(guide)): GuideHit[] {
  const hits: GuideHit[] = [];
  guide.sections.forEach((section, sectionIndex) => {
    const start = Math.max(section.start, from);
    const end = Math.min(section.start + section.beats, to);
    if (end <= start + EPSILON) {
      return;
    }
    const barLength = guide.beats_per_bar;
    const firstBar = Math.floor((start - section.start) / barLength + EPSILON);
    for (let bar = firstBar; section.start + bar * barLength < end - EPSILON; bar += 1) {
      let cursor = section.start + bar * barLength;
      section.strum.beats.forEach((length, hit) => {
        const at = cursor;
        cursor += length;
        if (at < start - EPSILON || at >= end - EPSILON) {
          return;
        }
        const chord = chordAt(guide, at);
        if (chord < 0) {
          return;
        }
        hits.push({
          at: at - from,
          hold: Math.min(length, end - at),
          chord,
          section: sectionIndex,
          hit,
          direction: section.strum.directions[hit],
        });
      });
    }
  });
  return hits.sort((left, right) => left.at - right.at);
}

export function totalBeats(guide: SongGuide): number {
  const ends = [
    ...guide.chords.map((chord) => chord.start + chord.beats),
    ...guide.sections.map((section) => section.start + section.beats),
    ...guide.melody.map((note) => note.start + note.beats),
  ];
  return Math.max(0, ...ends);
}

/** La canción plana que usan la práctica con micrófono y el informe. */
export function songFromGuide(record: GuideRecord): Song | null {
  if (record.songId === null) {
    return null;
  }
  const { guide } = record;
  return {
    id: record.songId,
    title: guide.title,
    artist: guide.artist,
    songKey: guide.song_key ?? "",
    bpm: guide.bpm,
    chords: guide.chords.map((chord) => ({
      bar: Math.floor(chord.start / guide.beats_per_bar + EPSILON) + 1,
      beat: Math.round((chord.start % guide.beats_per_bar) * 1000) / 1000 + 1,
      chord: chord.chord,
    })),
  };
}

// --- Notación del editor --------------------------------------------------------------

const STRUM_LETTER: Record<StrumDirection, string> = { abajo: "D", arriba: "U", apagado: "X" };
const LETTER_STRUM: Record<string, StrumDirection> = { D: "abajo", U: "arriba", X: "apagado" };

/** "D-DU-UDU": cada carácter es un casillero; el más corto del patrón define su tamaño. */
export function strumToText(strum: GuideSection["strum"]): string {
  const slot = Math.min(...strum.beats);
  return strum.directions
    .map((direction, index) => {
      const slots = Math.max(1, Math.round(strum.beats[index] / slot));
      return STRUM_LETTER[direction] + "-".repeat(slots - 1);
    })
    .join("");
}

export function strumFromText(text: string, beatsPerBar: number): GuideSection["strum"] {
  const slots = text.toUpperCase().replace(/\s+/g, "").split("");
  if (slots.length === 0 || slots.some((slot) => !(slot in LETTER_STRUM) && slot !== "-")) {
    throw new Error("Usa D (abajo), U (arriba), X (apagado) y - (silencio).");
  }
  if (slots[0] === "-") {
    throw new Error("El rasgueo empieza con un golpe.");
  }
  const size = beatsPerBar / slots.length;
  const directions: StrumDirection[] = [];
  const beats: number[] = [];
  for (const slot of slots) {
    if (slot === "-") {
      beats[beats.length - 1] += size;
    } else {
      directions.push(LETTER_STRUM[slot]);
      beats.push(size);
    }
  }
  return { directions, beats };
}

/** Los acordes de una sección como "| G | D . C . |": un tramo por compás. */
export function barsToText(guide: SongGuide, section: GuideSection): string {
  const barLength = guide.beats_per_bar;
  const bars: string[] = [];
  for (
    let start = section.start;
    start < section.start + section.beats - EPSILON;
    start += barLength
  ) {
    const inside = guide.chords.filter(
      (chord) => chord.start >= start - EPSILON && chord.start < start + barLength - EPSILON,
    );
    if (inside.length === 0) {
      bars.push(".");
      continue;
    }
    const smallest = Math.min(
      ...inside.map((chord) => Math.min(chord.beats, start + barLength - chord.start)),
      ...inside.map((chord) => (chord.start - start > EPSILON ? chord.start - start : barLength)),
    );
    const slots = Math.max(1, Math.round(barLength / smallest));
    const size = barLength / slots;
    const cells = Array.from({ length: slots }, () => ".");
    for (const chord of inside) {
      cells[Math.round((chord.start - start) / size)] = chord.chord;
    }
    bars.push(
      slots === 1 || cells.slice(1).every((cell) => cell === ".") ? cells[0] : cells.join(" "),
    );
  }
  return `| ${bars.join(" | ")} |`;
}

/**
 * Lee "| G | D . C . |" desde el inicio de la sección. "." prolonga el acorde anterior.
 * Devuelve los acordes y cuántos pulsos ocupa.
 */
export function barsFromText(
  text: string,
  start: number,
  beatsPerBar: number,
  isChord: (symbol: string) => boolean,
): { chords: GuideChord[]; beats: number } {
  const bars = text
    .split("|")
    .map((bar) => bar.trim().split(/\s+/).filter(Boolean))
    .filter((bar) => bar.length > 0);
  if (bars.length === 0) {
    throw new Error("La sección necesita al menos un compás.");
  }
  const chords: GuideChord[] = [];
  bars.forEach((cells, barIndex) => {
    const size = beatsPerBar / cells.length;
    cells.forEach((cell, index) => {
      const at = start + barIndex * beatsPerBar + index * size;
      if (cell === ".") {
        const last = chords.at(-1);
        if (last) {
          last.beats += size;
        }
        return;
      }
      if (!isChord(cell)) {
        throw new Error(`"${cell}" no es un acorde.`);
      }
      chords.push({ start: at, beats: size, chord: cell });
    });
  });
  return { chords, beats: bars.length * beatsPerBar };
}

/** Reemplaza los acordes de una sección y corre las secciones siguientes si cambia su largo. */
export function replaceSectionChords(
  guide: SongGuide,
  sectionIndex: number,
  chords: GuideChord[],
  beats: number,
): SongGuide {
  const section = guide.sections[sectionIndex];
  const shift = beats - section.beats;
  const end = section.start + section.beats;
  const kept = guide.chords
    .filter((chord) => chord.start < section.start - EPSILON || chord.start >= end - EPSILON)
    .map((chord) =>
      chord.start >= end - EPSILON ? { ...chord, start: chord.start + shift } : chord,
    );
  const sections = guide.sections.map((item, index) => {
    if (index === sectionIndex) {
      return { ...item, beats };
    }
    return item.start >= end - EPSILON ? { ...item, start: item.start + shift } : item;
  });
  const melody = guide.melody.map((note) =>
    note.start >= end - EPSILON ? { ...note, start: note.start + shift } : note,
  );
  return {
    ...guide,
    sections,
    melody,
    chords: [...kept, ...chords].sort((left, right) => left.start - right.start),
  };
}

/** Quita una sección con sus acordes y su melodía, y adelanta lo que venía después. */
export function removeSection(guide: SongGuide, sectionIndex: number): SongGuide {
  if (guide.sections.length <= 1) {
    throw new Error("La guía necesita al menos una sección.");
  }
  const section = guide.sections[sectionIndex];
  const end = section.start + section.beats;
  const inside = (start: number) => start >= section.start - EPSILON && start < end - EPSILON;
  const shift = (start: number) => (start >= end - EPSILON ? start - section.beats : start);
  return {
    ...guide,
    sections: guide.sections
      .filter((_, index) => index !== sectionIndex)
      .map((item) => ({ ...item, start: shift(item.start) })),
    chords: guide.chords
      .filter((chord) => !inside(chord.start))
      .map((chord) => ({ ...chord, start: shift(chord.start) })),
    melody: guide.melody
      .filter((note) => !inside(note.start))
      .map((note) => ({ ...note, start: shift(note.start) })),
  };
}

/** Agrega al final una sección de un compás con el último acorde, para empezar a editarla. */
export function appendSection(guide: SongGuide, name: string): SongGuide {
  const start = Math.max(...guide.sections.map((section) => section.start + section.beats));
  const last = guide.chords.at(-1)?.chord ?? "G";
  const strum = guide.sections.at(-1)?.strum ?? {
    directions: ["abajo"],
    beats: [guide.beats_per_bar],
  };
  return {
    ...guide,
    sections: [...guide.sections, { name, start, beats: guide.beats_per_bar, strum }],
    chords: [...guide.chords, { start, beats: guide.beats_per_bar, chord: last }],
  };
}
