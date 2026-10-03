const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export const A4_HZ = 440;
export const A4_MIDI = 69;

export interface NoteReading {
  name: string;
  octave: number;
  cents: number;
}

export function midiFromFrequency(frequency: number): number {
  if (frequency <= 0) {
    throw new Error("La frecuencia debe ser positiva.");
  }
  return A4_MIDI + 12 * Math.log2(frequency / A4_HZ);
}

export function noteFromFrequency(frequency: number): NoteReading {
  const exact = midiFromFrequency(frequency);
  const midi = Math.round(exact);
  const cents = Math.round((exact - midi) * 100);
  const name = NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { name, octave, cents };
}
