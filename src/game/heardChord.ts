import { parseChord } from "../domain/chart";

const SHARP: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

function pitchClass(symbol: string): string {
  return SHARP[symbol] ?? symbol;
}

export function detectedChord(note: string | null, expected: string): string | null {
  if (!note) {
    return null;
  }
  const root = pitchClass(parseChord(expected).root);
  const heard = pitchClass(note);
  if (heard === root) {
    return expected;
  }
  return heard;
}
