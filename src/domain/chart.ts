import type { ChartChord } from "./types";

const CHORD = /^([A-G])(#|b)?(.*)$/;
// Las mismas cualidades que acepta la API; las largas primero.
const CANONICAL =
  /^[A-G](#|b)?(maj9|maj7|m7b5|m7|m6|m9|7sus4|sus2|sus4|dim7|dim|aug|add9|m|7|6|9)?$/;

export function isChordSymbol(symbol: string): boolean {
  return CANONICAL.test(symbol.trim());
}

const SPANISH_ROOTS: Record<string, string> = {
  Do: "C",
  Re: "D",
  Mi: "E",
  Fa: "F",
  Sol: "G",
  La: "A",
  Si: "B",
};

// Cómo escriben la cualidad los cancioneros, hacia el símbolo que acepta la API.
const QUALITY_ALIASES: Record<string, string> = {
  "": "",
  maj: "",
  M: "",
  min: "m",
  mi: "m",
  "-": "m",
  M7: "maj7",
  Maj7: "maj7",
  "7M": "maj7",
  Δ: "maj7",
  Δ7: "maj7",
  "m7(b5)": "m7b5",
  ø: "m7b5",
  ø7: "m7b5",
  "°": "dim",
  "°7": "dim7",
  "+": "aug",
  sus: "sus4",
  "(9)": "add9",
  "2": "sus2",
  "4": "sus4",
  "5": "",
  min7: "m7",
  mi7: "m7",
  "-7": "m7",
};

const NO_CHORD = /^(n\.?c\.?|no chord|silence|silencio)$/i;
const LOOSE_CHORDS = [/^([A-G])(#|b)?(.*)$/, /^(Do|Re|Mi|Fa|Sol|La|Si)(#|b)?(.*)$/];

/**
 * Lee un acorde como viene en una tablatura o un cancionero: Lam, Sol, F/A, C5.
 * Devuelve el símbolo canónico, o null si ese texto no es un acorde.
 */
export function readChordSymbol(raw: string): string | null {
  const trimmed = raw.trim().replace(/[*_]/g, "").replace(/^\(+/, "").replace(/\)+$/, "").trim();
  if (!trimmed || NO_CHORD.test(trimmed)) {
    return null;
  }
  const head = trimmed
    .split("/")[0]
    .trim()
    .replace(/\s+menor$/i, "m")
    .replace(/\s+mayor$/i, "")
    .replace(/\s+/g, "");
  for (const pattern of LOOSE_CHORDS) {
    const match = pattern.exec(head);
    if (!match) {
      continue;
    }
    const root = SPANISH_ROOTS[match[1]] ?? match[1];
    const quality = QUALITY_ALIASES[match[3]] ?? match[3];
    const symbol = `${root}${match[2] ?? ""}${quality}`;
    if (isChordSymbol(symbol)) {
      return symbol;
    }
  }
  return null;
}

export function parseChord(symbol: string): { root: string; quality: string } {
  const match = CHORD.exec(symbol.trim());
  if (!match) {
    throw new Error(`Acorde inválido: ${symbol}`);
  }
  const quality = match[3] === "" ? "maj" : match[3];
  return { root: `${match[1]}${match[2] ?? ""}`, quality };
}

export function validateChart(events: ChartChord[]): void {
  if (events.length === 0) {
    throw new Error("La carta está vacía.");
  }
  for (const event of events) {
    if (event.bar < 1 || event.beat < 1) {
      throw new Error("Compás o tiempo inválido.");
    }
    parseChord(event.chord);
  }
}
