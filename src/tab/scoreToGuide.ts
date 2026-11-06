import { model } from "@coderline/alphatab";
import type { WireGuide } from "../api/guides";
import { bestChord } from "../audio/dsp/chordTemplates";
import { isChordSymbol } from "../domain/chart";
import type { StrumDirection } from "../domain/course";
import type { GuideChord, GuideNote, GuideSection, StrumEvent } from "../domain/guide";
import { lessonStrum, usForBpm } from "../domain/guide";

// alphaTab mide el tiempo en ticks: 960 por negra.
const TICKS_PER_QUARTER = 960;
const BARS_PER_PART = 8;
// Los mismos límites que valida la API.
const MAX_SECTIONS = 40;
const MAX_CHORDS = 2000;
const MAX_NOTES = 4000;
const MAX_TEMPO = 64;
const MAX_EVENT_SPAN = 64;
const MAX_EVENTS = 8000;
const MAX_STRUM_SLOTS = 32;
// Un golpe con dos cuerdas o más es rasgueo; una sola nota es punteo (riff o melodía).
const STRUM_MIN_NOTES = 2;
const DYNAMIC_VELOCITY: Record<number, number> = {
  [model.DynamicValue.PPP]: 0.35,
  [model.DynamicValue.PP]: 0.45,
  [model.DynamicValue.P]: 0.55,
  [model.DynamicValue.MP]: 0.68,
  [model.DynamicValue.MF]: 0.78,
  [model.DynamicValue.F]: 0.88,
  [model.DynamicValue.FF]: 0.95,
  [model.DynamicValue.FFF]: 1,
};
const MIN_MIDI = 28;
const MAX_MIDI = 100;
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const TRIADS = NAMES.flatMap((root) => [root, `${root}m`]);

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function pulse(ticks: number): number {
  return round(ticks / TICKS_PER_QUARTER);
}

function barBeats(bar: model.MasterBar): number {
  return (bar.timeSignatureNumerator * 4) / bar.timeSignatureDenominator;
}

function clampBpm(bpm: number): number {
  return Math.min(300, Math.max(20, Math.round(bpm)));
}

function tempoMap(score: model.Score): WireGuide["tempo"] {
  const points: WireGuide["tempo"] = [
    { pulse: 0, us_per_quarter: usForBpm(clampBpm(score.tempo)) },
  ];
  for (const bar of score.masterBars) {
    for (const automation of bar.tempoAutomations) {
      const at = round(pulse(bar.start) + automation.ratioPosition * barBeats(bar));
      const us = usForBpm(clampBpm(automation.value));
      const last = points[points.length - 1];
      if (Math.abs(last.pulse - at) < 1e-3) {
        last.us_per_quarter = us;
      } else if (last.us_per_quarter !== us) {
        points.push({ pulse: at, us_per_quarter: us });
      }
    }
  }
  return points.slice(0, MAX_TEMPO);
}

/**
 * Las notas punteadas de la guitarra (riffs, intros, solos), con sus ligaduras. Un golpe de
 * rasgueo no es melodía: lo toca la mano derecha como acorde y va a la lista de golpes.
 */
function melody(staff: model.Staff): GuideNote[] {
  const notes: GuideNote[] = [];
  for (const bar of staff.bars) {
    for (const beat of bar.voices[0]?.beats ?? []) {
      if (
        beat.isRest ||
        beat.notes.length === 0 ||
        beat.notes.length >= STRUM_MIN_NOTES ||
        beat.graceType !== model.GraceType.None
      ) {
        continue;
      }
      const top = beat.notes.reduce((high, note) =>
        note.realValue > high.realValue ? note : high,
      );
      const midi = top.realValue;
      const start = pulse(beat.absolutePlaybackStart);
      const beats = pulse(beat.playbackDuration);
      if (beats <= 0 || midi < MIN_MIDI || midi > MAX_MIDI || top.isDead) {
        continue;
      }
      const previous = notes[notes.length - 1];
      if (
        top.isTieDestination &&
        previous?.midi === midi &&
        Math.abs(previous.start + previous.beats - start) < 0.01
      ) {
        previous.beats = round(previous.beats + beats);
        continue;
      }
      notes.push({ start, beats, midi });
    }
  }
  return notes.slice(0, MAX_NOTES);
}

/** Los acordes que la tablatura escribe sobre los golpes, si los trae. */
function writtenChords(staff: model.Staff): Array<{ start: number; chord: string }> {
  const found: Array<{ start: number; chord: string }> = [];
  for (const bar of staff.bars) {
    for (const beat of bar.voices[0]?.beats ?? []) {
      const name = beat.chordId ? staff.chords?.get(beat.chordId)?.name?.trim() : undefined;
      if (name && isChordSymbol(name) && found.at(-1)?.chord !== name) {
        found.push({ start: pulse(beat.absolutePlaybackStart), chord: name });
      }
    }
  }
  return found;
}

/**
 * Sin cifrado escrito: el acorde de cada compás sale de sus notas. Se nombra la forma que
 * pisa la mano (sin la cejilla), como lo escribe un cancionero: Am con cejilla 1, no Bbm.
 */
function estimatedChords(staff: model.Staff): Array<{ start: number; chord: string }> {
  const found: Array<{ start: number; chord: string }> = [];
  const capo = Math.max(0, staff.capo);
  for (const bar of staff.bars) {
    const chroma = new Float32Array(12);
    let lowest = Infinity;
    for (const beat of bar.voices.flatMap((voice) => voice.beats)) {
      for (const note of beat.isRest ? [] : beat.notes) {
        if (note.isDead) {
          continue;
        }
        const shape = note.realValue - capo;
        chroma[((shape % 12) + 12) % 12] += beat.playbackDuration;
        lowest = Math.min(lowest, shape);
      }
    }
    if (lowest === Infinity) {
      continue;
    }
    // El bajo pesa más: suele ser la fundamental.
    chroma[((lowest % 12) + 12) % 12] += Math.max(...chroma) * 0.5;
    const chord = bestChord(chroma, TRIADS);
    if (chord && found.at(-1)?.chord !== chord) {
      found.push({ start: pulse(bar.masterBar.start), chord });
    }
  }
  return found;
}

function spans(marks: Array<{ start: number; chord: string }>, total: number): GuideChord[] {
  return marks
    .slice(0, MAX_CHORDS)
    .map((mark, index, list) => {
      const end = index + 1 < list.length ? list[index + 1].start : total;
      return { start: mark.start, beats: round(end - mark.start), chord: mark.chord };
    })
    .filter((chord) => chord.beats > 0);
}

/** El patrón de una sección: los golpes de su primer compás que tenga rasgueo. */
function sectionStrum(
  events: StrumEvent[],
  start: number,
  end: number,
  beatsPerBar: number,
): GuideSection["strum"] {
  for (let bar = start; bar < end - 1e-6; bar += beatsPerBar) {
    const barEnd = Math.min(end, bar + beatsPerBar);
    const strikes = events.filter(
      (event) =>
        event.contact !== "aire" && event.pulse >= bar - 1e-6 && event.pulse < barEnd - 1e-6,
    );
    if (strikes.length === 0 || strikes.length > MAX_STRUM_SLOTS) {
      continue;
    }
    return {
      directions: strikes.map((event) => event.direction),
      beats: strikes.map((event, index) =>
        round((strikes[index + 1]?.pulse ?? barEnd) - event.pulse),
      ),
    };
  }
  return lessonStrum(beatsPerBar);
}

function sections(
  score: model.Score,
  total: number,
  beatsPerBar: number,
  events: StrumEvent[],
): GuideSection[] {
  const marks = score.masterBars
    .filter((bar) => bar.section !== null)
    .map((bar) => ({
      start: pulse(bar.start),
      name: (bar.section?.text || bar.section?.marker || "Sección").trim().slice(0, 120),
    }));
  if (marks.length === 0 || marks[0].start > 0) {
    marks.unshift({ start: 0, name: marks.length === 0 ? "Parte 1" : "Intro" });
  }
  if (marks.length === 1 && total > BARS_PER_PART * beatsPerBar) {
    // Sin marcas de sección: partes de ocho compases para practicar en bucle.
    const part = BARS_PER_PART * beatsPerBar;
    marks.length = 0;
    for (let start = 0; start < total; start += part) {
      marks.push({ start, name: `Parte ${marks.length + 1}` });
    }
  }
  return marks
    .slice(0, MAX_SECTIONS)
    .map((mark, index, list) => {
      const end = index + 1 < list.length ? list[index + 1].start : total;
      return {
        name: mark.name,
        start: mark.start,
        beats: round(end - mark.start),
        strum: sectionStrum(events, mark.start, end, beatsPerBar),
      };
    })
    .filter((section) => section.beats > 0);
}

/** La dirección que marca el archivo con una flecha de púa o de barrido, si la marca. */
function writtenDirection(beat: model.Beat): StrumDirection | null {
  if (
    beat.pickStroke === model.PickStroke.Up ||
    beat.brushType === model.BrushType.BrushUp ||
    beat.brushType === model.BrushType.ArpeggioUp
  ) {
    return "arriba";
  }
  if (
    beat.pickStroke === model.PickStroke.Down ||
    beat.brushType === model.BrushType.BrushDown ||
    beat.brushType === model.BrushType.ArpeggioDown
  ) {
    return "abajo";
  }
  return null;
}

/**
 * Sin flecha, la mano derecha va y viene sin parar: abajo en las casillas pares de la
 * rejilla y arriba en las impares. La rejilla es de semicorcheas si el compás las usa.
 */
function gridDirection(at: number, barStart: number, sixteenths: boolean): StrumDirection {
  const unit = sixteenths ? 0.25 : 0.5;
  return Math.round((at - barStart) / unit) % 2 === 0 ? "abajo" : "arriba";
}

function strike(at: number, span: number, beat: model.Beat, direction: StrumDirection): StrumEvent {
  const dead = beat.notes.every((note) => note.isDead);
  return {
    pulse: at,
    span: Math.min(MAX_EVENT_SPAN, span),
    direction: dead ? "apagado" : direction,
    contact: dead ? "chuck" : "golpe",
    velocity: DYNAMIC_VELOCITY[beat.dynamics] ?? 0.82,
    origin: "escrito",
  };
}

function air(at: number, span: number): StrumEvent {
  return {
    pulse: at,
    span: Math.min(MAX_EVENT_SPAN, span),
    direction: "abajo",
    contact: "aire",
    velocity: 0,
    origin: "escrito",
  };
}

/** Un compás solo punteado: un golpe por acorde, para no rasguear cada nota del riff. */
function chordStrikes(chords: GuideChord[], barStart: number, barEnd: number): StrumEvent[] {
  return chords
    .filter((chord) => chord.start >= barStart - 1e-6 && chord.start < barEnd - 1e-6)
    .map((chord) => ({
      pulse: chord.start,
      span: round(
        Math.min(MAX_EVENT_SPAN, Math.min(chord.start + chord.beats, barEnd) - chord.start),
      ),
      direction: "abajo",
      contact: "golpe",
      velocity: 0.82,
      origin: "escrito",
    }));
}

/**
 * Los golpes de la mano derecha, leídos de la tablatura: cada golpe de dos cuerdas o más es
 * un rasgueo con su hueco real; un silencio o una nota ligada es aire, que deja sonar el
 * acorde. La dirección es la de la flecha del archivo o, sin flecha, la de la rejilla.
 */
function strumEvents(staff: model.Staff, chords: GuideChord[]): StrumEvent[] {
  const events: StrumEvent[] = [];
  for (const bar of staff.bars) {
    const beats = (bar.voices[0]?.beats ?? []).filter(
      (beat) => beat.graceType === model.GraceType.None && beat.playbackDuration > 0,
    );
    const barStart = pulse(bar.masterBar.start);
    const barEnd = round(barStart + barBeats(bar.masterBar));
    const strums = new Set(
      beats.filter(
        (beat) =>
          !beat.isRest &&
          beat.notes.length >= STRUM_MIN_NOTES &&
          !beat.notes.every((note) => note.isTieDestination),
      ),
    );
    if (strums.size === 0) {
      if (beats.some((beat) => !beat.isRest)) {
        events.push(...chordStrikes(chords, barStart, barEnd));
      }
      continue;
    }
    const sixteenths = [...strums].some((beat) => {
      const offset = (pulse(beat.absolutePlaybackStart) - barStart) % 0.5;
      return Math.abs(offset) > 0.01 && Math.abs(offset - 0.5) > 0.01;
    });
    for (const beat of beats) {
      const at = pulse(beat.absolutePlaybackStart);
      const span = pulse(beat.playbackDuration);
      if (strums.has(beat)) {
        const direction = writtenDirection(beat) ?? gridDirection(at, barStart, sixteenths);
        events.push(strike(at, span, beat, direction));
      } else {
        events.push(air(at, span));
      }
    }
  }
  return events.slice(0, MAX_EVENTS);
}

/**
 * Arma la guía de estudio de una pista de la tablatura: notas reales, acordes (escritos o
 * deducidos de las notas), secciones y mapa de tempo. El archivo sigue siendo la fuente
 * de lo que suena; la guía sirve para la carta, la práctica con micrófono y el informe.
 */
export function scoreToGuide(
  score: model.Score,
  trackIndex: number,
  fallbackTitle: string,
): WireGuide {
  const track = score.tracks.find((item) => item.index === trackIndex) ?? score.tracks[0];
  const staff = track?.staves[0];
  const first = score.masterBars[0];
  const last = score.masterBars[score.masterBars.length - 1];
  if (!staff || !first || !last) {
    throw new Error("La tablatura no trae pistas ni compases.");
  }
  const beatsPerBar = Math.min(12, Math.max(1, round(barBeats(first))));
  const total = pulse(last.start + last.calculateDuration());
  const written = writtenChords(staff);
  const marks = written.length > 0 ? written : estimatedChords(staff);
  if (marks.length === 0) {
    throw new Error("La pista elegida no tiene notas.");
  }
  // El primer acorde cubre lo que haya antes de él, para que la carta empiece en el pulso 0.
  marks[0] = { ...marks[0], start: 0 };
  const chords = spans(marks, total);
  const events = strumEvents(staff, chords);
  const title = (score.title || fallbackTitle || "Tablatura").trim().slice(0, 120);
  const artist = (score.artist || "Tablatura").trim().slice(0, 120);
  return {
    version: 2,
    title: title || "Tablatura",
    artist: artist || "Tablatura",
    song_key: null,
    bpm: clampBpm(score.tempo),
    beats_per_bar: beatsPerBar,
    // Los acordes son formas sobre la cejilla; la melodía ya está en la altura que suena.
    capo: Math.min(12, Math.max(0, staff.capo)),
    sections: sections(score, total, beatsPerBar, events),
    chords,
    melody: melody(staff),
    tempo: tempoMap(score),
    events,
  };
}
