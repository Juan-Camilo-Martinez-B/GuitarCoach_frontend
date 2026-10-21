import type { ChordShape } from "../chords/shapes";
import { STRUM_LAMENTO, strumHits, type StrumHit, type StrumPattern } from "../domain/course";

type Strum = StrumPattern["directions"][number];

const SAMPLE_ROOT =
  "https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/FluidR3_GM/acoustic_guitar_steel-mp3";

const PITCHES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const OPEN = [40, 45, 50, 55, 59, 64];

let audio: AudioContext | null = null;
let master: GainNode | null = null;
let generation = 0;
const live: Array<{ stop: () => void }> = [];
const files = new Map<number, Promise<ArrayBuffer | null>>();
const decoded = new Map<number, Promise<AudioBuffer | null>>();

function context(): AudioContext {
  audio ??= new AudioContext();
  if (!master) {
    master = audio.createGain();
    master.gain.value = 1;
    master.connect(audio.destination);
  }
  void audio.resume();
  return audio;
}

export function guitarSampleName(midi: number): string {
  const note = Math.min(108, Math.max(21, Math.round(midi)));
  const pitch = PITCHES[note % 12];
  const octave = Math.floor(note / 12) - 1;
  return `${pitch}${octave}`;
}

function sampleFile(midi: number): Promise<ArrayBuffer | null> {
  const note = Math.min(108, Math.max(21, Math.round(midi)));
  const cached = files.get(note);
  if (cached) {
    return cached;
  }
  const pending = fetch(`${SAMPLE_ROOT}/${guitarSampleName(note)}.mp3`)
    .then((response) => (response.ok ? response.arrayBuffer() : null))
    .catch(() => null);
  files.set(note, pending);
  return pending;
}

function loadSample(midi: number): Promise<AudioBuffer | null> {
  const note = Math.min(108, Math.max(21, Math.round(midi)));
  const cached = decoded.get(note);
  if (cached) {
    return cached;
  }
  const pending = sampleFile(note)
    .then(async (bytes) => {
      if (!bytes) {
        return null;
      }
      return context().decodeAudioData(bytes.slice(0));
    })
    .catch(() => null);
  decoded.set(note, pending);
  return pending;
}

export function warmNotes(midis: number[]): void {
  for (const midi of midis) {
    void sampleFile(midi);
  }
}

export function shapeMidis(chord: ChordShape): number[] {
  return chord.frets.flatMap((fret, index) => (fret < 0 ? [] : [OPEN[index] + fret]));
}

export function warmShape(chord: ChordShape): void {
  warmNotes(shapeMidis(chord));
}

export function stopGuitar(): void {
  generation += 1;
  for (const note of live) {
    note.stop();
  }
  live.length = 0;
}

export function playMidi(midi: number, when = 0, hold = 2.4): void {
  const clock = context();
  const start = clock.currentTime + when;
  const ticket = generation;
  void loadSample(midi).then((buffer) => {
    if (!buffer || !master || ticket !== generation) {
      return;
    }
    const source = clock.createBufferSource();
    source.buffer = buffer;
    const level = clock.createGain();
    source.connect(level);
    level.connect(master);
    const at = Math.max(clock.currentTime, start);
    const release = at + hold;
    level.gain.setValueAtTime(2.4, at);
    level.gain.setValueAtTime(2.4, release);
    level.gain.exponentialRampToValueAtTime(0.0001, release + 0.03);
    source.start(at);
    source.stop(release + 0.05);
    live.push({
      stop() {
        const time = clock.currentTime;
        try {
          level.gain.cancelScheduledValues(time);
          level.gain.setValueAtTime(Math.max(level.gain.value, 0.0001), time);
          level.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
          source.stop(time + 0.05);
        } catch {
          /* la nota ya terminó */
        }
      },
    });
  });
}

export function playShape(
  chord: ChordShape,
  direction: Strum = "abajo",
  spacing = 0.03,
  when = 0,
  hold = 2.4,
): void {
  const notes = shapeMidis(chord);
  const ordered = direction === "abajo" ? notes : [...notes].reverse();
  ordered.forEach((note, index) => playMidi(note, when + index * spacing, hold));
}

export function playChord(chord: ChordShape): void {
  stopGuitar();
  playShape(chord, "abajo", 0.012);
}

export function playStrum(chord: ChordShape, direction: Strum): void {
  stopGuitar();
  playShape(chord, direction, 0.045);
}

export function playPattern(
  chord: ChordShape,
  bpm: number,
  pattern: StrumPattern = STRUM_LAMENTO,
): StrumHit[] {
  stopGuitar();
  const hits = strumHits([4], bpm, pattern);
  for (const hit of hits) {
    playShape(chord, pattern.directions[hit.hit], 0.018, hit.at, hit.hold);
  }
  return hits;
}

export function playSlots(
  chords: Array<ChordShape | null>,
  lengths: number[],
  bpm: number,
  pattern: StrumPattern = STRUM_LAMENTO,
): StrumHit[] {
  stopGuitar();
  const hits = strumHits(lengths, bpm, pattern);
  for (const hit of hits) {
    const chord = chords[hit.slot];
    if (chord) {
      playShape(chord, pattern.directions[hit.hit], 0.018, hit.at, hit.hold);
    }
  }
  return hits;
}

export function patternDuration(bpm: number): number {
  return (60 / bpm) * 4;
}
