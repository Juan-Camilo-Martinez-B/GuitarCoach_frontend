import type { NoteReading } from "../dsp/noteMath";

export interface GuitarString {
  number: number;
  name: string;
  midi: number;
}

/** Afinación estándar, de la sexta a la primera. */
export const GUITAR_STRINGS: GuitarString[] = [
  { number: 6, name: "Mi grave", midi: 40 },
  { number: 5, name: "La", midi: 45 },
  { number: 4, name: "Re", midi: 50 },
  { number: 3, name: "Sol", midi: 55 },
  { number: 2, name: "Si", midi: 59 },
  { number: 1, name: "Mi agudo", midi: 64 },
];

// Dentro de este margen el oído no distingue la diferencia.
const IN_TUNE_CENTS = 5;
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function readingMidi(reading: NoteReading): number {
  return NAMES.indexOf(reading.name) + (reading.octave + 1) * 12 + reading.cents / 100;
}

/** La cuerda más cercana a lo que suena y cuántos cents le faltan o le sobran. */
export function nearestString(midi: number): { string: GuitarString; cents: number } {
  const string = GUITAR_STRINGS.reduce((best, item) =>
    Math.abs(item.midi - midi) < Math.abs(best.midi - midi) ? item : best,
  );
  return { string, cents: Math.round((midi - string.midi) * 100) };
}

export type TuningKind = "afinada" | "subir" | "bajar";

export function tuningAdvice(cents: number): { kind: TuningKind; text: string } {
  if (Math.abs(cents) <= IN_TUNE_CENTS) {
    return { kind: "afinada", text: "Afinada" };
  }
  return cents < 0
    ? { kind: "subir", text: "Grave: tensa la clavija" }
    : { kind: "bajar", text: "Aguda: afloja la clavija" };
}
