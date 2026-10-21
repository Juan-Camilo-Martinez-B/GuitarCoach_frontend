import { parseChord } from "../domain/chart";

export interface ChordShape {
  name: string;
  frets: number[];
  fingers: number[];
  barre: number | null;
}

const OPEN_MIDI = [40, 45, 50, 55, 59, 64];

const COURSE: Record<string, ChordShape> = {
  E: shape("E", [0, 2, 2, 1, 0, 0], [0, 2, 3, 1, 0, 0]),
  A: shape("A", [-1, 0, 2, 2, 2, 0], [0, 0, 1, 2, 3, 0]),
  D: shape("D", [-1, -1, 0, 2, 3, 2], [0, 0, 0, 1, 3, 2]),
  G: shape("G", [3, 2, 0, 0, 0, 3], [2, 1, 0, 0, 0, 3]),
  C: shape("C", [-1, 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0]),
  Em: shape("Em", [0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0]),
  Am: shape("Am", [-1, 0, 2, 2, 1, 0], [0, 0, 2, 3, 1, 0]),
  Dm: shape("Dm", [-1, -1, 0, 2, 3, 1], [0, 0, 0, 2, 3, 1]),
  D7: shape("D7", [-1, -1, 0, 2, 1, 2], [0, 0, 0, 2, 1, 3]),
  A7: shape("A7", [-1, 0, 2, 0, 2, 0], [0, 0, 2, 0, 3, 0]),
  F: shape("F", [1, 3, 3, 2, 1, 1], [1, 3, 4, 2, 1, 1], 1),
  Bm7: shape("Bm7", [-1, 2, 0, 2, 0, 2], [0, 1, 0, 2, 0, 3]),
  B7: shape("B7", [-1, 2, 1, 2, 0, 2], [0, 2, 1, 3, 0, 4]),
};

const SPANISH_CHORD: Record<string, string> = {
  Do: "C",
  Re: "D",
  Mi: "E",
  Fa: "F",
  Sol: "G",
  La: "A",
  Si: "B",
  Dom: "Cm",
  Rem: "Dm",
  Mim: "Em",
  Fam: "Fm",
  Solm: "Gm",
  Lam: "Am",
  Sim: "Bm",
  Sim7: "Bm7",
};

const NOTE_NAME: Record<string, string> = {
  Do: "C",
  Re: "D",
  Mi: "E",
  Fa: "F",
  Sol: "G",
  La: "A",
  Si: "B",
};

const KEY_ALIAS: Record<string, string> = {
  Db: "C#",
  Gb: "F#",
  "D#": "Eb",
  "G#": "Ab",
  "A#": "Bb",
};

const SUFFIX: Record<string, string> = {
  maj: "major",
  major: "major",
  m: "minor",
  min: "minor",
  minor: "minor",
  "7": "7",
  maj7: "maj7",
  m7: "m7",
  sus2: "sus2",
  sus4: "sus4",
  dim: "dim",
  aug: "aug",
  "6": "6",
  "9": "9",
  add9: "add9",
  "7sus4": "7sus4",
};

const PREFERRED_NOTE: Record<string, { string: number; fret: number }> = {
  E: { string: 1, fret: 0 },
  A: { string: 5, fret: 0 },
  D: { string: 4, fret: 0 },
  G: { string: 3, fret: 0 },
  B: { string: 2, fret: 0 },
  C: { string: 2, fret: 1 },
  F: { string: 1, fret: 1 },
};

const PITCH: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

const CHORD_BOOK = "https://cdn.jsdelivr.net/npm/@tombatossals/chords-db@0.5.1/lib/guitar.json";

interface RemotePosition {
  frets: number[];
  fingers: number[];
  barres?: number | number[];
  capo?: boolean;
}

interface RemoteChord {
  key: string;
  suffix: string;
  positions: RemotePosition[];
}

interface RemoteBook {
  chords: Record<string, RemoteChord[]>;
}

let bookRequest: Promise<RemoteBook | null> | null = null;

function shape(
  name: string,
  frets: number[],
  fingers: number[],
  barre: number | null = null,
): ChordShape {
  return { name, frets, fingers, barre };
}

export function englishSymbol(symbol: string): string {
  const trimmed = symbol.trim();
  return SPANISH_CHORD[trimmed] ?? trimmed;
}

export function localShape(symbol: string): ChordShape | null {
  const key = englishSymbol(symbol);
  return COURSE[key] ?? null;
}

export function loadChordBook(): Promise<RemoteBook | null> {
  bookRequest ??= fetch(CHORD_BOOK)
    .then((response) => (response.ok ? (response.json() as Promise<RemoteBook>) : null))
    .catch(() => null);
  return bookRequest;
}

export async function shapeFor(symbol: string): Promise<ChordShape | null> {
  const known = localShape(symbol);
  if (known) {
    return known;
  }
  const query = chordQuery(symbol);
  const book = await loadChordBook();
  if (!query || !book) {
    return null;
  }
  const bookKey = query.key === "C#" ? "Csharp" : query.key === "F#" ? "Fsharp" : query.key;
  const found = (book.chords[bookKey] ?? []).find((item) => item.suffix === query.suffix);
  const position = found?.positions[0];
  if (!position) {
    return null;
  }
  const listed = Array.isArray(position.barres) ? position.barres[0] : position.barres;
  const sounded = position.frets.filter((fret) => fret > 0);
  const barre = listed ?? (position.capo && sounded.length > 0 ? Math.min(...sounded) : null);
  return {
    name: englishSymbol(symbol),
    frets: position.frets,
    fingers: position.fingers,
    barre,
  };
}

export function chordQuery(symbol: string): { key: string; suffix: string } | null {
  try {
    const parsed = parseChord(englishSymbol(symbol));
    const key = KEY_ALIAS[parsed.root] ?? parsed.root;
    const suffix = SUFFIX[parsed.quality] ?? parsed.quality;
    return { key, suffix };
  } catch {
    return null;
  }
}

export function voicing(chord: ChordShape): number[] {
  return chord.frets.flatMap((fret, index) => (fret < 0 ? [] : [OPEN_MIDI[index] + fret]));
}

export function placeNote(symbol: string): { string: number; fret: number; midi: number } | null {
  const pitch = pitchClass(symbol);
  if (pitch === null) {
    return null;
  }
  const name = Object.entries(PITCH).find(([, value]) => value === pitch)?.[0] ?? "";
  const preferred = PREFERRED_NOTE[name];
  if (preferred) {
    const open = OPEN_MIDI[6 - preferred.string];
    return { ...preferred, midi: open + preferred.fret };
  }
  for (let fret = 0; fret <= 4; fret += 1) {
    for (let index = 0; index < OPEN_MIDI.length; index += 1) {
      if ((OPEN_MIDI[index] + fret) % 12 === pitch) {
        return { string: 6 - index, fret, midi: OPEN_MIDI[index] + fret };
      }
    }
  }
  return null;
}

export function spanishName(symbol: string): string {
  const key = englishSymbol(symbol);
  const names: Record<string, string> = {
    C: "Do",
    D: "Re",
    E: "Mi",
    F: "Fa",
    G: "Sol",
    A: "La",
    B: "Si",
    Em: "Mim",
    Am: "Lam",
    Dm: "Rem",
    Gm: "Solm",
    D7: "Re7",
    A7: "La7",
    Bm: "Sim",
    Bm7: "Sim7",
    B7: "Si7",
  };
  return names[key] ?? key;
}

function pitchClass(symbol: string): number | null {
  const note = NOTE_NAME[symbol.trim()];
  if (note) {
    return PITCH[note];
  }
  const match = englishSymbol(symbol).match(/^([A-G])([#b])?/);
  if (!match) {
    return null;
  }
  return PITCH[`${match[1]}${match[2] ?? ""}`] ?? null;
}
