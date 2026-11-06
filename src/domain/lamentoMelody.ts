import type { GuideNote } from "./guide";

const EIGHTH = 0.5;

// La lección va en La menor, con acordes abiertos: la transcripción está en Mi menor. Bajar
// siete semitonos conserva la misma melodía y la deja cerca de la cejuela.
const TO_A_MINOR = -7;

// Arpegio de corcheas que se repite sobre el ciclo de acordes, en MIDI y por compás, en la
// altura original. Tomado de la pista de solos (compases 24 a 31) de la transcripción en
// Guitar Pro de Alberto Serna Orejuela. El archivo original no se distribuye con la aplicación.
const BARS: readonly (readonly number[])[] = [
  [55, 59, 55, 64, 55, 59, 55, 64],
  [55, 59, 55, 64, 55, 59, 55, 64],
  [59, 62, 59, 66, 59, 62, 59, 66],
  [59, 62, 59, 66, 59, 62, 59, 66],
  [57, 60, 57, 64, 57, 60, 57, 64],
  [57, 60, 57, 64, 57, 60, 57, 64],
  [55, 59, 55, 64, 55, 59, 55, 64],
  [59, 57, 59, 66, 59, 57, 59, 66],
];

export const LAMENTO_MELODY: readonly GuideNote[] = BARS.flatMap((bar, barIndex) =>
  bar.map((midi, noteIndex) => ({
    start: barIndex * 4 + noteIndex * EIGHTH,
    beats: EIGHTH,
    midi: midi + TO_A_MINOR,
  })),
);
