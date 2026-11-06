import { decideChord, scoreCandidates, type ChordJudgement } from "../dsp/chordRecognizer";

/** Un tramo de la carta: qué acorde pide y cuándo, en segundos del reloj de audio. */
export interface ChordSlot {
  symbol: string;
  at: number;
  end: number;
}

export interface SlotResult {
  judgement: ChordJudgement;
  /** Desfase del ataque más cercano; null si en ese tramo no se oyó ningún ataque. */
  deltaMs: number | null;
}

// Las ventanas largas distinguen mejor los graves, así que pesan más.
const WINDOW_WEIGHT: Record<number, number> = { 2048: 1, 4096: 2, 8192: 3 };
// Cuánto antes de su tiempo puede entrar un acorde sin contarse para el anterior.
const MAX_EARLY_SECONDS = 0.12;
const EARLY_SHARE = 0.4;

/** Junta lo oído de varias ventanas y da un solo veredicto, más estable que el de cada una. */
export class ChordEvidence {
  private readonly scores = new Map<string, number>();
  private weight = 0;

  add(chroma: Float32Array, windowSize: number, candidates: string[]): void {
    const weight = WINDOW_WEIGHT[windowSize] ?? 1;
    for (const [candidate, score] of scoreCandidates(chroma, candidates)) {
      this.scores.set(candidate, (this.scores.get(candidate) ?? 0) + score * weight);
    }
    this.weight += weight;
  }

  get empty(): boolean {
    return this.weight === 0;
  }

  judge(expected: string): ChordJudgement {
    if (this.empty) {
      return { heard: null, ok: false, score: 0 };
    }
    const averaged = new Map(
      [...this.scores].map(([candidate, score]) => [candidate, score / this.weight] as const),
    );
    return decideChord(averaged, expected);
  }
}

/**
 * Reparte lo que se oye entre los tramos de la carta. Cada ataque cuenta para el tramo más
 * cercano, así los tramos cortos de una canción rápida no se pisan.
 */
export class ChordScoreFollower {
  private readonly evidence: ChordEvidence[];
  private readonly onsets: Array<number | null>;

  constructor(
    readonly slots: ChordSlot[],
    private readonly candidates: (symbol: string) => string[],
  ) {
    this.evidence = slots.map(() => new ChordEvidence());
    this.onsets = slots.map(() => null);
  }

  private early(index: number): number {
    const slot = this.slots[index];
    return Math.min(MAX_EARLY_SECONDS, (slot.end - slot.at) * EARLY_SHARE);
  }

  /** El tramo al que pertenece un instante, o -1 si cae fuera de la canción. */
  indexAt(time: number): number {
    for (let index = 0; index < this.slots.length; index += 1) {
      const next = index + 1 < this.slots.length ? index + 1 : null;
      const start = this.slots[index].at - this.early(index);
      const stop = next === null ? this.slots[index].end : this.slots[next].at - this.early(next);
      if (time >= start && time < stop) {
        return index;
      }
    }
    return -1;
  }

  addOnset(time: number): number {
    const index = this.indexAt(time);
    if (index < 0) {
      return index;
    }
    const target = this.slots[index].at;
    const current = this.onsets[index];
    if (current === null || Math.abs(time - target) < Math.abs(current - target)) {
      this.onsets[index] = time;
    }
    return index;
  }

  addChroma(onsetAt: number | null, at: number, windowSize: number, chroma: Float32Array): number {
    const index = this.indexAt(onsetAt ?? at);
    if (index >= 0) {
      this.evidence[index].add(chroma, windowSize, this.candidates(this.slots[index].symbol));
    }
    return index;
  }

  result(index: number): SlotResult {
    const onset = this.onsets[index];
    return {
      judgement: this.evidence[index].judge(this.slots[index].symbol),
      deltaMs: onset === null ? null : Math.round((onset - this.slots[index].at) * 1000),
    };
  }
}

export type NoteMark = "bien" | "no" | "saltada";

export interface NoteProgress {
  position: number;
  marks: NoteMark[];
  /** La nota oída fue la esperada. */
  matched: boolean;
}

// Si la nota oída aparece poco más adelante, el alumno se saltó las de en medio.
const LOOK_AHEAD = 3;

/**
 * Sigue una melodía en orden, sin exigir tiempo: se compara la nota sin importar la octava,
 * porque la misma nota puede tocarse en otra cuerda y el detector a veces duda de la octava.
 */
export class MelodyFollower {
  private position = 0;
  private readonly marks: NoteMark[] = [];

  constructor(private readonly expected: number[]) {}

  get done(): boolean {
    return this.position >= this.expected.length;
  }

  hear(midi: number): NoteProgress {
    if (this.done) {
      return this.progress(false);
    }
    const stop = Math.min(this.expected.length, this.position + LOOK_AHEAD + 1);
    for (let index = this.position; index < stop; index += 1) {
      if ((this.expected[index] - midi) % 12 === 0) {
        for (let skipped = this.position; skipped < index; skipped += 1) {
          this.marks[skipped] = "saltada";
        }
        this.marks[index] = "bien";
        this.position = index + 1;
        return this.progress(true);
      }
    }
    this.marks[this.position] = "no";
    return this.progress(false);
  }

  private progress(matched: boolean): NoteProgress {
    return { position: this.position, marks: [...this.marks], matched };
  }

  accuracy(): number {
    if (this.expected.length === 0) {
      return 0;
    }
    return (this.marks.filter((mark) => mark === "bien").length / this.expected.length) * 100;
  }
}

const NOTE_NAMES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];

export function noteLabel(midi: number): string {
  return NOTE_NAMES[((midi % 12) + 12) % 12];
}
