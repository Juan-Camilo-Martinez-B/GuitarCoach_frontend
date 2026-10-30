import { spanishName } from "../chords/shapes";
import { detectedChord } from "./heardChord";

export type VerdictKind = "bien" | "no" | "espera";

export function chordVerdict(heard: string | null, expected: string): VerdictKind {
  if (!heard) {
    return "espera";
  }
  return detectedChord(heard, expected) === expected ? "bien" : "no";
}

export function chordVerdictText(heard: string | null, expected: string): string {
  const name = spanishName(expected);
  const kind = chordVerdict(heard, expected);
  if (kind === "espera") {
    return `Escuchando. Toca ${name}.`;
  }
  if (kind === "bien") {
    return `Bien. Tocaste ${name}.`;
  }
  return `No. Se oyó ${heard}, no ${name}.`;
}

/** Lo que se dice tras escuchar un acorde completo con el reconocedor por croma. */
export function judgementVerdict(
  heard: string | null,
  ok: boolean,
  expected: string,
): { text: string; kind: VerdictKind } {
  const name = spanishName(expected);
  if (ok) {
    return { text: `Bien. Sonó ${name}.`, kind: "bien" };
  }
  if (!heard) {
    return { text: `Escuchando. Toca ${name} con todas sus cuerdas.`, kind: "espera" };
  }
  return { text: `Se oye ${spanishName(heard)}, no ${name}. Revisa los dedos.`, kind: "no" };
}
