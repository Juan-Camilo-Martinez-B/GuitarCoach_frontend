import { decideChord, scoreCandidates, type ChordJudgement } from "../dsp/chordRecognizer";
import type { ChordFrameEvent } from "./guitarListener";

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

/**
 * Lleva el croma que suena a la altura de la forma que pisa la mano. Con cejilla en el traste
 * N todo suena N semitonos arriba: la forma de La menor con cejilla 1 suena como Si bemol menor.
 */
export function shapeChroma(chroma: Float32Array, capo: number): Float32Array {
  const shift = ((Math.round(capo) % 12) + 12) % 12;
  if (shift === 0) {
    return chroma;
  }
  return chroma.map((_, pitch) => chroma[(pitch + shift) % 12]);
}

/** Lo que el oyente entrega de cada ventana analizada, sin el tipo de evento. */
export type ChordFrame = Omit<ChordFrameEvent, "type">;

interface HeardWindow {
  at: number;
  weight: number;
  scores: Map<string, number>;
}

// Con menos peso que una ventana de 2048 y una de 4096, el veredicto todavía duda.
const SETTLED_WEIGHT = WINDOW_WEIGHT[2048] + WINDOW_WEIGHT[4096];

/**
 * Junta lo oído de varias ventanas y da un solo veredicto, más estable que el de cada una.
 * Con `spanSeconds` solo cuenta lo reciente: sirve para escuchar sin un tiempo marcado.
 */
export class ChordEvidence {
  private heard: HeardWindow[] = [];

  /** capo: traste de la cejilla; los acordes esperados son las formas sobre ella. */
  constructor(
    private readonly capo = 0,
    private readonly spanSeconds = Infinity,
  ) {}

  add(frame: ChordFrame, candidates: string[]): void {
    const scores = scoreCandidates(shapeChroma(frame.chroma, this.capo), candidates);
    this.heard.push({ at: frame.at, weight: WINDOW_WEIGHT[frame.windowSize] ?? 1, scores });
    if (Number.isFinite(this.spanSeconds)) {
      const oldest = frame.at - this.spanSeconds;
      this.heard = this.heard.filter((window) => window.at >= oldest);
    }
  }

  private get weight(): number {
    return this.heard.reduce((sum, window) => sum + window.weight, 0);
  }

  get empty(): boolean {
    return this.heard.length === 0;
  }

  /** Ya se oyó lo bastante para no cambiar de opinión con el ruido del primer golpe. */
  get settled(): boolean {
    return this.weight >= SETTLED_WEIGHT;
  }

  judge(expected: string): ChordJudgement {
    if (this.empty) {
      return { heard: null, ok: false, score: 0 };
    }
    const weight = this.weight;
    const averaged = new Map<string, number>();
    for (const window of this.heard) {
      for (const [candidate, score] of window.scores) {
        averaged.set(candidate, (averaged.get(candidate) ?? 0) + (score * window.weight) / weight);
      }
    }
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
  private lastStrike: { at: number; index: number } | null = null;

  constructor(
    readonly slots: ChordSlot[],
    private readonly candidates: (symbol: string) => string[],
    capo = 0,
  ) {
    this.evidence = slots.map(() => new ChordEvidence(capo));
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

  /** El tramo que contiene el intervalo entero, sin adelantos; -1 si cruza un cambio. */
  private indexCovering(from: number, to: number): number {
    return this.slots.findIndex((slot, index) => {
      const stop = this.slots[index + 1]?.at ?? slot.end;
      return from >= slot.at && to <= stop;
    });
  }

  addOnset(time: number): number {
    const index = this.indexAt(time);
    if (index < 0) {
      return index;
    }
    this.lastStrike = { at: time, index };
    const target = this.slots[index].at;
    const current = this.onsets[index];
    if (current === null || Math.abs(time - target) < Math.abs(current - target)) {
      this.onsets[index] = time;
    }
    return index;
  }

  /**
   * Lo que sigue vibrando sin ataque nuevo es del último golpe. Al cambiar de acorde las
   * cuerdas del anterior siguen sonando: solo cuenta para el tramo de ese golpe o para uno
   * que pida el mismo acorde, nunca para el acorde que todavía no se tocó.
   */
  private sustainIndex(frame: ChordFrame): number {
    const strike = this.lastStrike;
    if (!strike || frame.from < strike.at) {
      return -1;
    }
    const index = this.indexCovering(frame.from, frame.at);
    if (index < 0) {
      return index;
    }
    const sameChord = this.slots[index].symbol === this.slots[strike.index].symbol;
    return index === strike.index || sameChord ? index : -1;
  }

  addChroma(frame: ChordFrame): number {
    const index = frame.onsetAt === null ? this.sustainIndex(frame) : this.indexAt(frame.onsetAt);
    if (index >= 0) {
      this.evidence[index].add(frame, this.candidates(this.slots[index].symbol));
    }
    return index;
  }

  /** El tramo ya tiene suficiente evidencia para mostrar un veredicto en vivo. */
  settled(index: number): boolean {
    return this.evidence[index]?.settled ?? false;
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
