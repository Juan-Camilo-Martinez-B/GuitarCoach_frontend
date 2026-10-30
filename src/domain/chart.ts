import type { ChartChord } from "./types";

const CHORD = /^([A-G])(#|b)?(.*)$/;
// Las mismas cualidades que acepta la API; las largas primero.
const CANONICAL =
  /^[A-G](#|b)?(maj9|maj7|m7b5|m7|m6|m9|7sus4|sus2|sus4|dim7|dim|aug|add9|m|7|6|9)?$/;

export function isChordSymbol(symbol: string): boolean {
  return CANONICAL.test(symbol.trim());
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
