import type { StrumDirection } from "../../domain/course";
import { jitter, type Random } from "./random";

/** Cuerda pisada: string 0 es la sexta (Mi grave), igual que el orden de los trastes. */
export interface StringNote {
  string: number;
  midi: number;
}

export interface NoteStrike {
  string: number;
  midi: number;
  at: number;
  velocity: number;
  muted: boolean;
}

export interface StrumRequest {
  notes: StringNote[];
  direction: StrumDirection;
  at: number;
  velocity: number;
  quarter: number;
}

// Hacia arriba la púa casi nunca llega a las cuerdas graves.
const UP_STROKE_STRINGS = 4;
const MIN_VELOCITY = 0.05;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** Tiempo total que tarda la púa en cruzar las cuerdas: más corto a más tempo y más fuerza. */
export function strumSpread(velocity: number, quarter: number): number {
  const byTempo = clamp(quarter * 0.045, 0.015, 0.05);
  return byTempo * (1.15 - 0.3 * clamp(velocity, 0, 1));
}

/** Intensidad según el lugar del golpe en el compás de cuatro tiempos. */
export function accentFor(beatPosition: number): number {
  const inBar = ((beatPosition % 4) + 4) % 4;
  const nearest = Math.round(inBar);
  if (Math.abs(inBar - nearest) > 0.01) {
    return 0.66;
  }
  if (nearest % 4 === 0) {
    return 0.95;
  }
  return nearest === 2 ? 0.85 : 0.78;
}

export function performStrum(request: StrumRequest, random: Random): NoteStrike[] {
  const ordered = [...request.notes].sort((left, right) => left.string - right.string);
  if (ordered.length === 0) {
    return [];
  }
  const muted = request.direction === "apagado";
  const upward = request.direction === "arriba";
  const struck = upward ? ordered.slice(-UP_STROKE_STRINGS).reverse() : ordered;
  const base = request.velocity * (upward ? 0.78 : muted ? 0.9 : 1);
  const spread = strumSpread(request.velocity, request.quarter) * (upward ? 0.8 : muted ? 0.5 : 1);
  const step = struck.length > 1 ? spread / (struck.length - 1) : 0;
  const fade = upward ? 0.18 : 0.12;

  let cursor = request.at;
  return struck.map((note, index) => {
    if (index > 0) {
      cursor += Math.max(0.002, step + jitter(random, step * 0.15));
    }
    const position = struck.length > 1 ? index / (struck.length - 1) : 0;
    const velocity = base * (1 - fade * position) * (1 + jitter(random, 0.06));
    return {
      string: note.string,
      midi: note.midi,
      at: cursor,
      velocity: clamp(velocity, MIN_VELOCITY, 1),
      muted,
    };
  });
}
