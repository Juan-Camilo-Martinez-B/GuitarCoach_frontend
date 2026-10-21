import type { Curriculum, LessonView } from "./types";

const OUTLINE: Array<Omit<LessonView, "status" | "locked">> = [
  {
    id: "cuerdas",
    title: "Las cuerdas, del 1 al 6",
    summary: "La numeración sale de la más aguda, no del orden en que las miras.",
    points: [
      "La cuerda 1 es la más fina y la más aguda. Al aire suena Mi.",
      "La cuerda 6 es la más gruesa y la más grave. Al aire suena Mi, dos octavas abajo.",
      "De la 6 a la 1, al aire: Mi, La, Re, Sol, Si, Mi.",
      "Con la guitarra en posición, la 6 queda arriba, cerca de la cara, y la 1 abajo.",
    ],
    songTitle: null,
  },
  {
    id: "trastes",
    title: "Los trastes y desde dónde se cuentan",
    summary: "El número del traste se cuenta desde la cejuela hacia el cuerpo.",
    points: [
      "Los trastes son las tiras de metal que cruzan el diapasón.",
      "Se empiezan a contar en la cejuela, el huesito junto a las clavijas.",
      "El traste 1 es el primer espacio después de la cejuela.",
      "Al aire significa no pisar: el número es 0. El dedo va justo detrás del metal.",
    ],
    songTitle: null,
  },
  {
    id: "acorde",
    title: "Qué es un acorde",
    summary: "Un acorde son varias notas a la vez, con un nombre que dice su base.",
    points: [
      "Rasguear varias cuerdas juntas forma un acorde.",
      "El nombre dice la fundamental: Sol se apoya en la nota Sol.",
      "La m lo hace menor: Mim suena más cerrado que Mi.",
      "Un cambio es soltar una forma y armar la siguiente a tiempo.",
    ],
    songTitle: null,
  },
  {
    id: "notas",
    title: "Do, Re, Mi, Fa, Sol, La, Si",
    summary: "Estas siete notas alcanzan para las primeras melodías.",
    points: [
      "Do, Re, Mi, Fa, Sol, La, Si se escriben C, D, E, F, G, A, B.",
      "Al aire ya están Mi (cuerdas 6 y 1), La (5), Re (4), Sol (3) y Si (2).",
      "Do está en la cuerda 2, traste 1. Fa está en la cuerda 1, traste 1.",
      "Re también está en la cuerda 2, traste 3.",
    ],
    songTitle: null,
  },
  {
    id: "abiertos",
    title: "Acordes abiertos",
    summary: "Cuatro formas alcanzan para las primeras canciones.",
    points: [
      "Mim: pisas la cuerda 5 en el traste 2 y la 4 en el traste 2.",
      "Sol: cuerda 6 traste 3, cuerda 5 traste 2, cuerda 1 traste 3.",
      "Do: cuerda 5 traste 3, cuerda 4 traste 2, cuerda 2 traste 1.",
      "Re: cuerda 3 traste 2, cuerda 2 traste 3, cuerda 1 traste 2. La 6 y la 5 no suenan.",
      "Lam: cuerda 2 traste 1, cuerda 4 traste 2, cuerda 3 traste 2.",
    ],
    songTitle: null,
  },
  {
    id: "rasgueo",
    title: "Rasgueo básico",
    summary: "La mano marca el pulso antes de acelerar.",
    points: [
      "Abajo va de la cuerda 6 hacia la 1. Arriba vuelve.",
      "El básico son cuatro golpes hacia abajo, todos del mismo tiempo.",
      "Se mueve la muñeca. El antebrazo casi quieto.",
      "Primero lento, a 60 pulsos. Cada ↓ dura un tiempo.",
    ],
    songTitle: null,
  },
  {
    id: "cancion-abiertos",
    title: "Canción: Cambios abiertos",
    summary: "Cuatro acordes mayores y menores, sin prisa.",
    points: [
      "La carta es Sol, Re, Mim y Do, a 72 BPM.",
      "El rasgueo alterna ↓ y ↑: el ↓ dura un tiempo y medio, el ↑ medio tiempo.",
      "Primero el acorde solo, después con el rasgueo y al final la progresión.",
    ],
    songTitle: "Cambios abiertos",
  },
  {
    id: "cancion-menores",
    title: "Canción: Ronda de menores",
    summary: "Una vuelta corta en Lam para afirmar el cambio.",
    points: [
      "La carta es Lam, Rem, Mi y Lam, a 66 BPM.",
      "El primer ↓ dura dos tiempos. Después un ↓ y un ↑ de un tiempo.",
      "Practica cada acorde solo y luego la vuelta completa.",
    ],
    songTitle: "Ronda de menores",
  },
  {
    id: "cancion-lamento",
    title: "Canción: Lamento boliviano",
    summary: "La armonía de la canción, en su tempo, sin la letra.",
    points: [
      "Va a 124 BPM, el tempo de la canción, en compás de cuatro.",
      "La armonía es Mim, Sim7, Lam y, en el último compás, Mim y Si7. Sim7 va sin cejilla.",
      "El primer rasgueo dura un tiempo; los cinco siguientes, medio tiempo.",
      "No incluye la letra. Practica Mim, Sim7, Lam, Mim y Si7.",
    ],
    songTitle: "Lamento boliviano",
  },
];

export const STRUM_LAMENTO = {
  directions: ["abajo", "abajo", "arriba", "arriba", "abajo", "arriba"],
  beats: [1, 0.5, 0.5, 0.5, 0.5, 0.5],
  hint: "El primer ↓ dura un tiempo. Los otros cinco duran medio tiempo.",
} as const;

export const STRUM_BASICO = {
  directions: ["abajo", "abajo", "abajo", "abajo"],
  beats: [1, 1, 1, 1],
  hint: "Cuatro ↓ iguales. Cada uno dura un tiempo.",
} as const;

export const STRUM_ABIERTOS = {
  directions: ["abajo", "arriba", "abajo", "arriba"],
  beats: [1.5, 0.5, 1.5, 0.5],
  hint: "El ↓ dura un tiempo y medio. El ↑ dura medio tiempo. Se repite.",
} as const;

export const STRUM_MENORES = {
  directions: ["abajo", "abajo", "arriba"],
  beats: [2, 1, 1],
  hint: "El primer ↓ dura dos tiempos. Los dos siguientes duran un tiempo.",
} as const;

export type StrumPattern =
  typeof STRUM_LAMENTO | typeof STRUM_BASICO | typeof STRUM_ABIERTOS | typeof STRUM_MENORES;

export const STRUM_PATTERN = STRUM_LAMENTO.directions;
export const STRUM_BEATS = STRUM_LAMENTO.beats;

export function patternForTitle(title: string): StrumPattern {
  if (title === "Cambios abiertos") {
    return STRUM_ABIERTOS;
  }
  if (title === "Ronda de menores") {
    return STRUM_MENORES;
  }
  if (title === "Lamento boliviano") {
    return STRUM_LAMENTO;
  }
  return STRUM_BASICO;
}

export interface SongSlot {
  symbol: string;
  beats: number;
  note: string;
}

export interface SongGuide {
  bpm: number;
  slots: SongSlot[];
  pattern: StrumPattern;
}

export const SONG_GUIDES: Record<string, SongGuide> = {
  "cancion-abiertos": {
    bpm: 72,
    pattern: STRUM_ABIERTOS,
    slots: [
      { symbol: "G", beats: 4, note: "G" },
      { symbol: "D", beats: 4, note: "D" },
      { symbol: "Em", beats: 4, note: "E" },
      { symbol: "C", beats: 4, note: "C" },
    ],
  },
  "cancion-menores": {
    bpm: 66,
    pattern: STRUM_MENORES,
    slots: [
      { symbol: "Am", beats: 4, note: "A" },
      { symbol: "Dm", beats: 4, note: "D" },
      { symbol: "E", beats: 4, note: "E" },
      { symbol: "Am", beats: 4, note: "A" },
    ],
  },
  "cancion-lamento": {
    bpm: 124,
    pattern: STRUM_LAMENTO,
    slots: [
      { symbol: "Em", beats: 4, note: "E" },
      { symbol: "Bm7", beats: 4, note: "B" },
      { symbol: "Am", beats: 4, note: "A" },
      { symbol: "Em", beats: 2, note: "E" },
      { symbol: "B7", beats: 2, note: "B" },
    ],
  },
};

export interface StrumHit {
  at: number;
  slot: number;
  hit: number;
  hold: number;
}

export function strumHits(
  lengths: number[],
  bpm: number,
  pattern: StrumPattern = STRUM_LAMENTO,
): StrumHit[] {
  const quarter = 60 / bpm;
  const hits: StrumHit[] = [];
  let origin = 0;
  lengths.forEach((length, slot) => {
    const end = origin + length;
    const firstBar = Math.floor(origin / 4);
    const lastBar = Math.floor((end - 1e-9) / 4);
    for (let bar = firstBar; bar <= lastBar; bar += 1) {
      let cursor = bar * 4;
      pattern.beats.forEach((beats, hit) => {
        if (cursor >= origin - 1e-9 && cursor < end - 1e-9) {
          hits.push({ at: cursor * quarter, slot, hit, hold: beats * quarter });
        }
        cursor += beats;
      });
    }
    origin = end;
  });
  return hits;
}

export function previewCurriculum(): Curriculum {
  return {
    needsReview: false,
    review: [],
    lessons: OUTLINE.map((lesson) => ({
      ...lesson,
      status: "pending",
      locked: false,
    })),
  };
}
