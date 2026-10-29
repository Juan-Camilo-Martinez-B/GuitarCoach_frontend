import type { ChordShape } from "../chords/shapes";
import {
  STRUM_LAMENTO,
  strumHits,
  type StrumDirection,
  type StrumHit,
  type StrumPattern,
} from "../domain/course";
import { createOutputChain } from "./guitar/outputChain";
import { jitter, seededRandom, type Random } from "./guitar/random";
import { SampleBank, type GuitarSample } from "./guitar/sampleBank";
import { accentFor, performStrum, type NoteStrike, type StringNote } from "./guitar/strumPerformer";
import { StringVoices } from "./guitar/stringVoices";

export { guitarSampleName } from "./guitar/sampleBank";

const SAMPLE_ROOTS = [
  `${import.meta.env.BASE_URL}samples/guitar-steel`,
  "https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/FluidR3_GM/acoustic_guitar_steel-mp3",
];

const OPEN = [40, 45, 50, 55, 59, 64];
// Margen para programar el primer golpe sin que llegue tarde.
const LEAD = 0.06;
const CHORD_RING = 4.5;
const HIT_TIMING_JITTER = 0.006;
const DETUNE_CENTS = 3;

interface Engine {
  context: AudioContext;
  voices: StringVoices;
}

const bank = new SampleBank(SAMPLE_ROOTS);
let engine: Engine | null = null;
let generation = 0;
let seed = 1;

function audioEngine(): Engine {
  if (!engine) {
    const context = new AudioContext({ latencyHint: "interactive" });
    engine = { context, voices: new StringVoices(context, createOutputChain(context)) };
  }
  void engine.context.resume();
  return engine;
}

function freshRandom(): Random {
  seed += 1;
  return seededRandom(seed * 7919);
}

function stringNotes(chord: ChordShape): StringNote[] {
  return chord.frets.flatMap((fret, string) =>
    fret < 0 ? [] : [{ string, midi: OPEN[string] + fret }],
  );
}

function mutedStrings(chord: ChordShape): number[] {
  return chord.frets.flatMap((fret, string) => (fret < 0 ? [string] : []));
}

export function shapeMidis(chord: ChordShape): number[] {
  return stringNotes(chord).map((note) => note.midi);
}

export function warmNotes(midis: number[]): void {
  bank.prefetch(midis);
}

export function warmShape(chord: ChordShape): void {
  warmNotes(shapeMidis(chord));
}

export function stopGuitar(): void {
  generation += 1;
  engine?.voices.stopAll();
}

/** Corta lo que estaba programado, pero deja sonar las cuerdas que ya vibran. */
function cancelPending(): number {
  generation += 1;
  if (engine) {
    engine.voices.cancelAfter(engine.context.currentTime);
  }
  return generation;
}

interface StrumPlan {
  chord: ChordShape;
  direction: StrumDirection;
  at: number;
  velocity: number;
  quarter: number;
}

function schedule(
  { context, voices }: Engine,
  samples: Map<number, GuitarSample>,
  strikes: NoteStrike[],
  ring: number,
  random: Random,
): void {
  for (const strike of strikes) {
    const sample = samples.get(strike.midi);
    if (sample) {
      voices.strike({ ...strike, at: Math.max(strike.at, context.currentTime) }, sample, {
        ring,
        detuneCents: jitter(random, DETUNE_CENTS),
      });
    }
  }
}

/** Espera las muestras y programa los rasgueos. Devuelve el retraso real, o null si se canceló. */
async function performStrums(plans: (start: number) => StrumPlan[], chords: ChordShape[]) {
  const ticket = cancelPending();
  const active = audioEngine();
  const samples = await bank.loadAll(active.context, chords.flatMap(shapeMidis));
  if (ticket !== generation) {
    return null;
  }
  const random = freshRandom();
  const start = active.context.currentTime + LEAD;
  for (const plan of plans(start)) {
    // Las cuerdas que no van en el acorde se apagan con los dedos al cambiar.
    for (const string of mutedStrings(plan.chord)) {
      active.voices.damp(string, plan.at);
    }
    const strikes = performStrum(
      {
        notes: stringNotes(plan.chord),
        direction: plan.direction,
        at: plan.at,
        velocity: plan.velocity,
        quarter: plan.quarter,
      },
      random,
    );
    schedule(active, samples, strikes, CHORD_RING, random);
  }
  return LEAD;
}

export function playMidi(midi: number, when = 0, hold = 2.4, velocity = 0.8): void {
  const ticket = generation;
  const active = audioEngine();
  const start = active.context.currentTime + when;
  void bank.loadAll(active.context, [midi]).then((samples) => {
    if (ticket !== generation) {
      return;
    }
    const string = OPEN.reduce((best, open, index) => (open <= midi ? index : best), 0);
    const random = freshRandom();
    schedule(
      active,
      samples,
      [{ string, midi, at: Math.max(start, active.context.currentTime), velocity, muted: false }],
      hold,
      random,
    );
  });
}

export function playChord(chord: ChordShape): void {
  void performStrums(
    (start) => [{ chord, direction: "abajo", at: start, velocity: 0.7, quarter: 1 }],
    [chord],
  );
}

export function playStrum(chord: ChordShape, direction: StrumDirection): void {
  void performStrums(
    (start) => [{ chord, direction, at: start, velocity: 0.85, quarter: 0.6 }],
    [chord],
  );
}

function hitPlans(
  hits: StrumHit[],
  chordFor: (hit: StrumHit) => ChordShape | null,
  bpm: number,
  pattern: StrumPattern,
  random: Random,
) {
  const quarter = 60 / bpm;
  return (start: number): StrumPlan[] =>
    hits.flatMap((hit) => {
      const chord = chordFor(hit);
      if (!chord) {
        return [];
      }
      const offset = hit.at === 0 ? 0 : jitter(random, HIT_TIMING_JITTER);
      return [
        {
          chord,
          direction: pattern.directions[hit.hit],
          at: start + hit.at + offset,
          velocity: accentFor(hit.at / quarter) * (1 + jitter(random, 0.05)),
          quarter,
        },
      ];
    });
}

function shifted(hits: StrumHit[], delay: number | null): StrumHit[] {
  if (delay === null) {
    return [];
  }
  return hits.map((hit) => ({ ...hit, at: hit.at + delay }));
}

/** Un compás del patrón con un acorde. Resuelve con los golpes ya alineados al audio. */
export async function playPattern(
  chord: ChordShape,
  bpm: number,
  pattern: StrumPattern = STRUM_LAMENTO,
): Promise<StrumHit[]> {
  const hits = strumHits([4], bpm, pattern);
  const delay = await performStrums(
    hitPlans(hits, () => chord, bpm, pattern, freshRandom()),
    [chord],
  );
  return shifted(hits, delay);
}

export async function playSlots(
  chords: Array<ChordShape | null>,
  lengths: number[],
  bpm: number,
  pattern: StrumPattern = STRUM_LAMENTO,
): Promise<StrumHit[]> {
  const hits = strumHits(lengths, bpm, pattern);
  const present = chords.filter((chord): chord is ChordShape => chord !== null);
  const delay = await performStrums(
    hitPlans(hits, (hit) => chords[hit.slot] ?? null, bpm, pattern, freshRandom()),
    present,
  );
  return shifted(hits, delay);
}

export function patternDuration(bpm: number): number {
  return (60 / bpm) * 4;
}
