import type { ChordShape } from "../chords/shapes";
import {
  STRUM_LAMENTO,
  strumHits,
  type StrumDirection,
  type StrumHit,
  type StrumPattern,
} from "../domain/course";
import type { GuideHit, GuideNote, TempoPoint } from "../domain/guide";
import { pulseToSeconds, usAt } from "../domain/guide";
import { Metronome } from "./guitar/metronome";
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
const CHUCK_RING = 0.07;
// Ventana corta: el deslizador se oye en el golpe siguiente.
const LOOKAHEAD_SECONDS = 0.1;
const PUMP_MS = 25;
const LATE_SKIP_SECONDS = 1.5;
const HIT_TIMING_JITTER = 0.006;
const DETUNE_CENTS = 3;
// Con melodía, el rasgueo baja y la melodía sube: si no, seis cuerdas la tapan.
const BACKING_UNDER_MELODY = 0.6;
const MELODY_VELOCITY = 0.95;
// Melodía y acompañamiento en lugares distintos del estéreo, como dos guitarras.
const LEAD_PAN = 0.3;
const BACKING_PAN = -0.15;

interface Engine {
  context: AudioContext;
  voices: StringVoices;
  /** Segunda guitarra para la melodía: así no apaga las cuerdas del acompañamiento. */
  lead: StringVoices;
  metronome: Metronome;
}

const bank = new SampleBank(SAMPLE_ROOTS);
let engine: Engine | null = null;
let generation = 0;
let seed = 1;
let pumpTimer: number | undefined;

function clearPump(): void {
  if (pumpTimer !== undefined) {
    window.clearTimeout(pumpTimer);
    pumpTimer = undefined;
  }
}

function panned(context: AudioContext, output: AudioNode, pan: number): AudioNode {
  const panner = context.createStereoPanner();
  panner.pan.value = pan;
  panner.connect(output);
  return panner;
}

function audioEngine(): Engine {
  if (!engine) {
    const context = new AudioContext({ latencyHint: "interactive" });
    const output = createOutputChain(context);
    engine = {
      context,
      voices: new StringVoices(context, panned(context, output, BACKING_PAN)),
      lead: new StringVoices(context, panned(context, output, LEAD_PAN)),
      metronome: new Metronome(context, context.destination),
    };
  }
  void engine.context.resume();
  return engine;
}

function freshRandom(): Random {
  seed += 1;
  return seededRandom(seed * 7919);
}

function stringNotes(chord: ChordShape, capo = 0): StringNote[] {
  return chord.frets.flatMap((fret, string) =>
    fret < 0 ? [] : [{ string, midi: OPEN[string] + fret + capo }],
  );
}

function mutedStrings(chord: ChordShape): number[] {
  return chord.frets.flatMap((fret, string) => (fret < 0 ? [string] : []));
}

function stringFor(midi: number): number {
  return OPEN.reduce((best, open, index) => (open <= midi ? index : best), 0);
}

export function shapeMidis(chord: ChordShape, capo = 0): number[] {
  return stringNotes(chord, capo).map((note) => note.midi);
}

export function warmNotes(midis: number[]): void {
  bank.prefetch(midis);
}

export function warmShape(chord: ChordShape): void {
  warmNotes(shapeMidis(chord));
}

export function stopGuitar(): void {
  generation += 1;
  clearPump();
  engine?.voices.stopAll();
  engine?.lead.stopAll();
  engine?.metronome.stopAll();
}

/** Corta lo que estaba programado, pero deja sonar las cuerdas que ya vibran. */
function cancelPending(): number {
  generation += 1;
  clearPump();
  if (engine) {
    engine.voices.cancelAfter(engine.context.currentTime);
    engine.lead.cancelAfter(engine.context.currentTime);
    engine.metronome.stopAll();
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
  steady = false,
): void {
  for (const strike of strikes) {
    const sample = samples.get(strike.midi);
    if (sample) {
      voices.strike({ ...strike, at: Math.max(strike.at, context.currentTime) }, sample, {
        ring,
        detuneCents: steady ? 0 : jitter(random, DETUNE_CENTS),
      });
    }
  }
}

/** Espera las muestras y programa los rasgueos. Devuelve el retraso real, o null si se canceló. */
async function performStrums(
  plans: (start: number) => StrumPlan[],
  chords: ChordShape[],
  capo = 0,
) {
  const ticket = cancelPending();
  const active = audioEngine();
  const samples = await bank.loadAll(
    active.context,
    chords.flatMap((chord) => shapeMidis(chord, capo)),
  );
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
        notes: stringNotes(plan.chord, capo),
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
    const string = stringFor(midi);
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

export function playStrum(chord: ChordShape, direction: StrumDirection, capo = 0): void {
  void performStrums(
    (start) => [{ chord, direction, at: start, velocity: 0.85, quarter: 0.6 }],
    [chord],
    capo,
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

export interface GuidePlayback {
  /** Forma de cada acorde de la guía, en el mismo orden; null si no se encontró. */
  shapes: Array<ChordShape | null>;
  hits: GuideHit[];
  /** Alturas que suenan: la cejilla ya va incluida, no se vuelve a sumar. */
  notes: GuideNote[];
  /** Mapa de tempo en pulsos absolutos de la canción. */
  tempo: TempoPoint[];
  /** 1 es el tempo escrito. 0,5 alarga todos los huecos el doble. */
  rate: number;
  /** Pulso absoluto donde empieza el tramo. Los golpes de hits están restados de aquí. */
  from: number;
  beatsPerBar: number;
  /** Pulsos de clic antes del primer golpe. */
  countIn: number;
  metronome: boolean;
  length: number;
  /** Trastes de cejilla: sube el sonido sin cambiar la forma que se ve. */
  capo?: number;
}

/**
 * Toca un tramo de una guía. Resuelve con los segundos que faltan para el primer golpe
 * (cuenta de entrada incluida), o null si otra reproducción lo reemplazó.
 */
export async function playGuide(playback: GuidePlayback): Promise<number | null> {
  const ticket = cancelPending();
  const active = audioEngine();
  if (active.context.state !== "running") {
    await active.context.resume();
  }
  const capo = playback.capo ?? 0;
  const present = playback.shapes.filter((shape): shape is ChordShape => shape !== null);
  const samples = await bank.loadAll(active.context, [
    ...present.flatMap((shape) => shapeMidis(shape, capo)),
    ...playback.notes.map((note) => note.midi),
  ]);
  if (ticket !== generation) {
    return null;
  }
  const rate = playback.rate > 0 ? playback.rate : 1;
  const rel = (pulse: number) =>
    pulseToSeconds(playback.from + pulse, playback.tempo, rate) -
    pulseToSeconds(playback.from, playback.tempo, rate);
  const quarterAtStart = usAt(playback.from, playback.tempo) / 1_000_000 / rate;
  const random = freshRandom();
  const origin = active.context.currentTime + LEAD;
  const start = origin + playback.countIn * quarterAtStart;
  const clicks = playback.countIn + (playback.metronome ? Math.ceil(playback.length) : 0);
  const backing = playback.notes.length > 0 ? BACKING_UNDER_MELODY : 1;
  const notes = [...playback.notes].sort((left, right) => left.start - right.start);
  let beatIndex = 0;
  let hitIndex = 0;
  let noteIndex = 0;

  const pump = () => {
    if (ticket !== generation) {
      return;
    }
    const now = active.context.currentTime;
    const horizon = now + LOOKAHEAD_SECONDS;
    let delta = 0;
    let deltaSet = false;
    const place = (at: number): number | null => {
      if (at > horizon) {
        return null;
      }
      if (at < now - LATE_SKIP_SECONDS) {
        return null;
      }
      if (at < now) {
        if (!deltaSet) {
          delta = now - at;
          deltaSet = true;
        }
        return at + delta;
      }
      return at;
    };
    while (beatIndex < clicks) {
      const inSong = beatIndex - playback.countIn;
      const at = inSong < 0 ? origin + beatIndex * quarterAtStart : start + rel(inSong);
      if (at > horizon) {
        break;
      }
      beatIndex += 1;
      const when = place(at);
      if (when === null) {
        continue;
      }
      const accent = inSong < 0 ? beatIndex === 1 : inSong % playback.beatsPerBar === 0;
      active.metronome.click(when, accent);
    }
    while (hitIndex < playback.hits.length) {
      const hit = playback.hits[hitIndex];
      const at = start + rel(hit.at);
      if (at > horizon) {
        break;
      }
      hitIndex += 1;
      if (hit.contact === "aire") {
        continue;
      }
      const when = place(at);
      const chord = playback.shapes[hit.chord];
      if (when === null || !chord) {
        continue;
      }
      const chuck = hit.contact === "chuck" || hit.direction === "apagado";
      if (!chuck) {
        for (const string of mutedStrings(chord)) {
          active.voices.damp(string, when);
        }
      }
      schedule(
        active,
        samples,
        performStrum(
          {
            notes: stringNotes(chord, capo),
            direction: hit.direction,
            at: when,
            velocity: Math.min(1, hit.energy * backing),
            quarter: usAt(playback.from + hit.at, playback.tempo) / 1_000_000,
            steady: true,
            muted: chuck,
          },
          random,
        ),
        chuck ? CHUCK_RING : CHORD_RING,
        random,
        true,
      );
    }
    while (noteIndex < notes.length) {
      const note = notes[noteIndex];
      const at = start + rel(note.start);
      if (at > horizon) {
        break;
      }
      noteIndex += 1;
      const when = place(at);
      const sample = samples.get(note.midi);
      if (when === null || !sample) {
        continue;
      }
      active.lead.strike(
        {
          string: stringFor(note.midi),
          midi: note.midi,
          at: when,
          velocity: MELODY_VELOCITY,
          muted: false,
        },
        sample,
        { ring: rel(note.start + note.beats) - rel(note.start) + 0.05, detuneCents: 0 },
      );
    }
    const pending =
      beatIndex < clicks || hitIndex < playback.hits.length || noteIndex < notes.length;
    if (pending && ticket === generation) {
      pumpTimer = window.setTimeout(pump, PUMP_MS);
    }
  };
  pump();
  return start - active.context.currentTime;
}
