import { spanishName } from "../chords/shapes";

export type VerdictKind = "bien" | "no" | "espera";

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
