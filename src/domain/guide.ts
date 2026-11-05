import type { StrumDirection, StrumPattern } from "./course";
import { parseChord } from "./chart";
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

/** El reloj a partir de este pulso. 500000 microsegundos son 120 BPM. */
export interface TempoPoint {
  pulse: number;
  usPerQuarter: number;
}

export type StrumContact = "golpe" | "chuck" | "aire";
export type EventOrigin = "escrito" | "inferido" | "editado" | "leccion";

/** Un casillero de la mano derecha. El aire no ataca y no corta el acorde. */
export interface StrumEvent {
  pulse: number;
  span: number;
  direction: StrumDirection;
  contact: StrumContact;
  velocity: number;
  origin: EventOrigin;
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
  tempo?: TempoPoint[];
  events?: StrumEvent[];
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

/** Un golpe de rasgueo de la guía, en pulsos relativos al tramo que se toca. */
export interface GuideHit {
  at: number;
  hold: number;
  chord: number;
  section: number;
  hit: number;
  direction: StrumDirection;
  /** Dinámica escrita, de 0 a 1. */
  energy: number;
  contact: StrumContact;
  origin: EventOrigin;
  event: number;
}

const EPSILON = 1e-6;

export function usForBpm(bpm: number): number {
  return Math.round(60_000_000 / bpm);
}

export function bpmFromUs(usPerQuarter: number): number {
  return Math.round(60_000_000 / usPerQuarter);
}

/** Segundos de pared desde el pulso 0. La velocidad de práctica solo divide el reloj. */
export function pulseToSeconds(pulse: number, tempo: TempoPoint[], rate: number): number {
  const speed = rate > 0 ? rate : 1;
  const points = [...(tempo.length ? tempo : [{ pulse: 0, usPerQuarter: 500_000 }])].sort(
    (left, right) => left.pulse - right.pulse,
  );
  if (points[0].pulse > EPSILON) {
    points.unshift({ pulse: 0, usPerQuarter: points[0].usPerQuarter });
  }
  const target = Math.max(0, pulse);
  let seconds = 0;
  let cursor = 0;
  for (let index = 0; index < points.length && cursor < target - EPSILON; index += 1) {
    const next = index + 1 < points.length ? points[index + 1].pulse : target;
    const from = Math.max(cursor, points[index].pulse);
    const to = Math.min(target, next);
    if (to > from) {
      seconds += ((to - from) * points[index].usPerQuarter) / 1_000_000 / speed;
      cursor = to;
    }
  }
  return seconds;
}

export function usAt(pulse: number, tempo: TempoPoint[]): number {
  let us = tempo[0]?.usPerQuarter ?? usForBpm(80);
  for (const point of tempo) {
    if (point.pulse <= pulse + EPSILON) {
      us = point.usPerQuarter;
    }
  }
  return us;
}

function isBasicStrum(
  strum: { directions: StrumDirection[]; beats: number[] },
  beatsPerBar: number,
): boolean {
  const whole = Math.max(1, Math.round(beatsPerBar));
  if (
    strum.directions.length !== whole ||
    strum.directions.some((direction) => direction !== "abajo")
  ) {
    return false;
  }
  const beat = beatsPerBar / whole;
  return strum.beats.every((value) => Math.abs(value - beat) < 1e-3);
}

function expandPattern(
  start: number,
  beats: number,
  beatsPerBar: number,
  strum: { directions: StrumDirection[]; beats: number[] },
  origin: EventOrigin,
): StrumEvent[] {
  const events: StrumEvent[] = [];
  for (let bar = start; bar < start + beats - EPSILON; bar += beatsPerBar) {
    let cursor = bar;
    strum.beats.forEach((length, index) => {
      if (cursor >= start + beats - EPSILON) {
        return;
      }
      const span = Math.min(length, start + beats - cursor);
      const direction = strum.directions[index] ?? "abajo";
      events.push({
        pulse: cursor,
        span,
        direction,
        contact: direction === "apagado" ? "chuck" : "golpe",
        velocity: 0.82,
        origin,
      });
      cursor += length;
    });
  }
  return events;
}

/** Rellena tempo y golpes si la guía guardada todavía no los trae. No cambia un patrón escrito. */
export function ensureGrid(guide: SongGuide): SongGuide {
  const raw = (guide.tempo ?? []) as Array<TempoPoint & { us_per_quarter?: number }>;
  const tempo = raw.length
    ? raw.map((point) => ({
        pulse: point.pulse,
        usPerQuarter: point.usPerQuarter || point.us_per_quarter || usForBpm(guide.bpm),
      }))
    : [{ pulse: 0, usPerQuarter: usForBpm(guide.bpm) }];
  if (guide.events?.length) {
    return { ...guide, tempo };
  }
  const events = guide.sections.flatMap((section) =>
    expandPattern(
      section.start,
      section.beats,
      guide.beats_per_bar,
      section.strum,
      isBasicStrum(section.strum, guide.beats_per_bar) ? "inferido" : "escrito",
    ),
  );
  return { ...guide, version: 2, tempo, events };
}

/** Rasgueo que se puede copiar cuando la carta no trae el suyo. */
export function lessonStrum(beatsPerBar: number): { directions: StrumDirection[]; beats: number[] } {
  if (Math.abs(beatsPerBar - 4) < 0.05) {
    return {
      directions: ["abajo", "abajo", "arriba", "abajo", "arriba"],
      beats: [1, 1, 0.5, 0.5, 1],
    };
  }
  if (Math.abs(beatsPerBar - 3) < 0.05) {
    return { directions: ["abajo", "arriba"], beats: [2, 1] };
  }
  if (Math.abs(beatsPerBar - 2) < 0.05) {
    return { directions: ["abajo", "arriba"], beats: [1, 1] };
  }
  const whole = Math.max(1, Math.round(beatsPerBar));
  return {
    directions: Array.from({ length: whole }, () => "abajo"),
    beats: Array.from({ length: whole }, () => beatsPerBar / whole),
  };
}

export function lessonHint(beatsPerBar: number): string {
  if (Math.abs(beatsPerBar - 4) < 0.05) {
    return "Abajo, abajo, arriba, abajo, arriba. Los dos del medio duran medio tiempo. La melodía canta la fundamental y la tercera de cada acorde.";
  }
  if (Math.abs(beatsPerBar - 3) < 0.05) {
    return "Abajo en el primer tiempo, largo, y arriba al final del compás. La melodía sigue el acorde.";
  }
  return "Un golpe por tiempo, con una melodía que sigue el acorde para que la copies.";
}

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function lessonMelody(chords: GuideChord[]): GuideNote[] {
  const notes: GuideNote[] = [];
  let previous = 67;
  for (const chord of chords) {
    let root = 0;
    let color = 4;
    try {
      const parsed = parseChord(chord.chord);
      root = STEP[parsed.root[0]] ?? 0;
      if (parsed.root[1] === "#") {
        root += 1;
      } else if (parsed.root[1] === "b") {
        root -= 1;
      }
      const quality = parsed.quality;
      if (quality.startsWith("m") && !quality.startsWith("maj")) {
        color = 3;
      } else if (quality.includes("sus2")) {
        color = 2;
      } else if (quality.includes("sus")) {
        color = 5;
      } else if (quality.includes("dim")) {
        color = 3;
      }
    } catch {
      root = 7;
    }
    let midi = 60 + root;
    while (midi < previous - 5) {
      midi += 12;
    }
    while (midi > previous + 6) {
      midi -= 12;
    }
    midi = Math.min(81, Math.max(60, midi));
    if (chord.beats >= 2) {
      const half = chord.beats / 2;
      notes.push({ start: chord.start, beats: half, midi });
      notes.push({ start: chord.start + half, beats: chord.beats - half, midi: midi + color });
      previous = midi + color;
    } else {
      notes.push({ start: chord.start, beats: chord.beats, midi });
      previous = midi;
    }
  }
  return notes;
}

function isUntaught(events: StrumEvent[], beatsPerBar: number): boolean {
  if (events.length === 0) {
    return true;
  }
  if (events.some((event) => event.origin !== "inferido")) {
    return false;
  }
  const beat = beatsPerBar / Math.max(1, Math.round(beatsPerBar));
  return events.every(
    (event) =>
      event.direction === "abajo" &&
      event.contact === "golpe" &&
      Math.abs(event.span - beat) < 0.05,
  );
}

/**
 * Deja la canción lista para copiarla. Si la carta no traía rasgueo, pone el de la lección
 * y una melodía con las notas del acorde. Un rasgueo o una melodía ya escritos se quedan.
 */
export function prepareLesson(guide: SongGuide): SongGuide {
  const grid = ensureGrid(guide);
  const teach = isUntaught(grid.events!, grid.beats_per_bar);
  const pattern = lessonStrum(grid.beats_per_bar);
  const events = teach
    ? grid.sections.flatMap((section) =>
        expandPattern(section.start, section.beats, grid.beats_per_bar, pattern, "leccion"),
      )
    : grid.events!;
  const sections = teach
    ? grid.sections.map((section) => ({ ...section, strum: pattern }))
    : grid.sections;
  const melody = grid.melody.length > 0 ? grid.melody : lessonMelody(grid.chords);
  return { ...grid, sections, events, melody };
}

export function hasInferredTiming(guide: SongGuide, from = 0, to = Infinity): boolean {
  return ensureGrid(guide).events!.some(
    (event) =>
      event.origin === "inferido" && event.pulse >= from - EPSILON && event.pulse < to - EPSILON,
  );
}

export function sectionPattern(guide: SongGuide, sectionIndex: number): StrumPattern {
  const grid = ensureGrid(guide);
  const section = grid.sections[sectionIndex] ?? grid.sections[0];
  const barEnd = section.start + grid.beats_per_bar;
  const hits = grid.events!.filter(
    (event) =>
      event.contact !== "aire" &&
      event.pulse >= section.start - EPSILON &&
      event.pulse < barEnd - EPSILON,
  );
  if (hits.length === 0) {
    return { directions: ["abajo"], beats: [grid.beats_per_bar], hint: "" };
  }
  return {
    directions: hits.map((event) => event.direction),
    beats: hits.map((event) => event.span),
    hint: hits.some((event) => event.origin === "inferido")
      ? "Supuesto: un golpe por tiempo. Corrígelo para que sea el de la canción."
      : "",
  };
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

function sectionAt(guide: SongGuide, beat: number): number {
  const index = guide.sections.findIndex(
    (section) => section.start <= beat + EPSILON && beat < section.start + section.beats - EPSILON,
  );
  return index < 0 ? 0 : index;
}

/** Golpes entre from y to, leídos de la lista. El nombre de la sección no cambia el ritmo. */
export function guideHits(guide: SongGuide, from = 0, to = totalBeats(guide)): GuideHit[] {
  const grid = ensureGrid(guide);
  const hits: GuideHit[] = [];
  grid.events!.forEach((event, eventIndex) => {
    if (event.pulse < from - EPSILON || event.pulse >= to - EPSILON) {
      return;
    }
    const chord = chordAt(grid, event.pulse);
    if (chord < 0 && event.contact !== "aire") {
      return;
    }
    const section = sectionAt(grid, event.pulse);
    const barStart =
      grid.sections[section].start +
      Math.floor((event.pulse - grid.sections[section].start) / grid.beats_per_bar + EPSILON) *
        grid.beats_per_bar;
    const hit = grid.events!.filter(
      (item) =>
        item.pulse >= barStart - EPSILON &&
        item.pulse < barStart + grid.beats_per_bar - EPSILON &&
        item.pulse <= event.pulse + EPSILON,
    ).length;
    hits.push({
      at: event.pulse - from,
      hold: event.span,
      chord: Math.max(0, chord),
      section,
      hit: Math.max(0, hit - 1),
      direction: event.direction,
      energy: event.velocity,
      contact: event.contact,
      origin: event.origin,
      event: eventIndex,
    });
  });
  return hits;
}

export function totalBeats(guide: SongGuide): number {
  const ends = [
    ...guide.chords.map((chord) => chord.start + chord.beats),
    ...guide.sections.map((section) => section.start + section.beats),
    ...guide.melody.map((note) => note.start + note.beats),
    ...(guide.events ?? []).map((event) => event.pulse + event.span),
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
  const grid = ensureGrid(guide);
  return {
    ...grid,
    sections,
    melody,
    chords: [...kept, ...chords].sort((left, right) => left.start - right.start),
    events: shiftPulses(grid.events!, end, shift),
    tempo: shiftPulses(grid.tempo!, end, shift),
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
  const grid = ensureGrid(guide);
  return {
    ...grid,
    sections: guide.sections
      .filter((_, index) => index !== sectionIndex)
      .map((item) => ({ ...item, start: shift(item.start) })),
    chords: guide.chords
      .filter((chord) => !inside(chord.start))
      .map((chord) => ({ ...chord, start: shift(chord.start) })),
    melody: guide.melody
      .filter((note) => !inside(note.start))
      .map((note) => ({ ...note, start: shift(note.start) })),
    events: grid
      .events!.filter((event) => !inside(event.pulse))
      .map((event) => ({
        ...event,
        pulse: shift(event.pulse),
      })),
    tempo: [
      grid.tempo![0],
      ...grid
        .tempo!.slice(1)
        .filter((point) => !inside(point.pulse))
        .map((point) => ({
          ...point,
          pulse: shift(point.pulse),
        })),
    ],
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
  const grid = ensureGrid(guide);
  return {
    ...grid,
    sections: [...guide.sections, { name, start, beats: guide.beats_per_bar, strum }],
    chords: [...guide.chords, { start, beats: guide.beats_per_bar, chord: last }],
    events: [
      ...grid.events!,
      ...expandPattern(start, guide.beats_per_bar, guide.beats_per_bar, strum, "editado"),
    ],
  };
}

function shiftPulses<T extends { pulse: number }>(items: T[], end: number, shift: number): T[] {
  if (Math.abs(shift) < EPSILON) {
    return items;
  }
  return items.map((item) =>
    item.pulse >= end - EPSILON ? { ...item, pulse: item.pulse + shift } : item,
  );
}

/** El acorde posterior absorbe al anterior. Tres símbolos, al fundir los dos últimos, el tercero dura dos compases. */
export function mergeChordBack(guide: SongGuide, index: number): SongGuide {
  const grid = ensureGrid(guide);
  const later = grid.chords[index];
  const earlier = grid.chords[index - 1];
  if (!later || !earlier) {
    throw new Error("Elige el acorde que va a durar más.");
  }
  if (Math.abs(earlier.start + earlier.beats - later.start) > 0.05) {
    throw new Error("Solo se funden acordes que se tocan.");
  }
  const start = earlier.start;
  const beats = earlier.beats + later.beats;
  const chords = grid.chords.filter((_, position) => position !== index - 1);
  chords[index - 1] = { start, beats, chord: later.chord };
  const events = grid.events!.flatMap((event) => {
    if (
      Math.abs(event.pulse - earlier.start) < EPSILON &&
      Math.abs(event.span - earlier.beats) < 0.05
    ) {
      return [];
    }
    if (
      Math.abs(event.pulse - later.start) < EPSILON &&
      Math.abs(event.span - later.beats) < 0.05
    ) {
      return [{ ...event, pulse: start, span: beats, origin: "editado" as const }];
    }
    return [
      event.pulse >= start - EPSILON && event.pulse < start + beats
        ? { ...event, origin: "editado" as const }
        : event,
    ];
  });
  return { ...grid, chords, events };
}

/** Parte un acorde en dos del mismo símbolo. El primer tramo queda más corto. */
export function splitChord(guide: SongGuide, index: number): SongGuide {
  const grid = ensureGrid(guide);
  const chord = grid.chords[index];
  if (!chord || chord.beats < 0.5) {
    throw new Error("Ese acorde ya es demasiado corto para partirlo.");
  }
  const half = chord.beats / 2;
  const chords = [...grid.chords];
  chords.splice(
    index,
    1,
    { ...chord, beats: half },
    { start: chord.start + half, beats: half, chord: chord.chord },
  );
  const events = grid.events!.flatMap((event) => {
    if (
      Math.abs(event.pulse - chord.start) < EPSILON &&
      Math.abs(event.span - chord.beats) < 0.05
    ) {
      return [
        { ...event, span: half, origin: "editado" as const },
        { ...event, pulse: chord.start + half, span: half, origin: "editado" as const },
      ];
    }
    return [event];
  });
  return { ...grid, chords, events };
}

/**
 * Cambia el hueco de un golpe. Sin ancla, corre los golpes siguientes del tramo.
 * Con ancla, solo ese hueco y el del golpe que viene detrás.
 */
export function nudgeGap(
  guide: SongGuide,
  eventIndex: number,
  delta: number,
  anchorRest: boolean,
): SongGuide {
  const grid = ensureGrid(guide);
  const events = grid.events!.map((event) => ({ ...event }));
  const current = events[eventIndex];
  if (!current || current.span + delta < 0.25) {
    throw new Error("El hueco mínimo es un cuarto de tiempo.");
  }
  const section = grid.sections[sectionAt(grid, current.pulse)];
  const sectionEnd = section.start + section.beats;
  current.span += delta;
  current.origin = "editado";
  if (anchorRest) {
    const next = events[eventIndex + 1];
    if (next && next.pulse < sectionEnd - EPSILON && next.span - delta >= 0.25) {
      next.span -= delta;
      next.origin = "editado";
    }
    return { ...grid, events };
  }
  for (let index = eventIndex + 1; index < events.length; index += 1) {
    if (events[index].pulse >= sectionEnd - EPSILON) {
      break;
    }
    events[index] = { ...events[index], pulse: events[index].pulse + delta, origin: "editado" };
  }
  return { ...grid, events };
}

export function addTempoPoint(guide: SongGuide, pulse: number, bpm: number): SongGuide {
  const grid = ensureGrid(guide);
  if (bpm < 20 || bpm > 300) {
    throw new Error("El tempo va de 20 a 300 BPM.");
  }
  const usPerQuarter = usForBpm(bpm);
  const tempo = grid.tempo!.filter((point) => Math.abs(point.pulse - pulse) > 0.05);
  tempo.push({ pulse: Math.max(0, pulse), usPerQuarter });
  tempo.sort((left, right) => left.pulse - right.pulse);
  if (tempo[0].pulse > EPSILON) {
    tempo.unshift({ pulse: 0, usPerQuarter });
  }
  const opening = bpmFromUs(tempo[0].usPerQuarter);
  return { ...grid, tempo, bpm: opening };
}

/** Sustituye los golpes de una sección por los casilleros escritos y los marca como editados. */
export function retileSection(guide: SongGuide, sectionIndex: number, text: string): SongGuide {
  const grid = ensureGrid(guide);
  const section = grid.sections[sectionIndex];
  const slots = text.toUpperCase().replace(/\s+/g, "").split("");
  if (slots.length === 0 || slots.some((slot) => !"DUX-".includes(slot)) || slots[0] === "-") {
    throw new Error("Usa D (abajo), U (arriba), X (apagado) y - (silencio).");
  }
  const size = grid.beats_per_bar / slots.length;
  const fresh: StrumEvent[] = [];
  for (
    let bar = section.start;
    bar < section.start + section.beats - EPSILON;
    bar += grid.beats_per_bar
  ) {
    slots.forEach((slot, index) => {
      const pulse = bar + index * size;
      if (pulse >= section.start + section.beats - EPSILON) {
        return;
      }
      if (slot === "-") {
        fresh.push({
          pulse,
          span: size,
          direction: "abajo",
          contact: "aire",
          velocity: 0,
          origin: "editado",
        });
        return;
      }
      const direction = slot === "U" ? "arriba" : slot === "X" ? "apagado" : "abajo";
      fresh.push({
        pulse,
        span: size,
        direction,
        contact: direction === "apagado" ? "chuck" : "golpe",
        velocity: 0.82,
        origin: "editado",
      });
    });
  }
  const end = section.start + section.beats;
  const events = [
    ...grid.events!.filter(
      (event) => event.pulse < section.start - EPSILON || event.pulse >= end - EPSILON,
    ),
    ...fresh,
  ].sort((left, right) => left.pulse - right.pulse);
  return { ...grid, events };
}
