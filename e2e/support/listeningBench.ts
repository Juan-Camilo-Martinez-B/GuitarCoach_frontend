// Banco de pruebas en el navegador: toca muestras reales de guitarra a distintos tempos y mide
// qué entiende el oyente. No pasa por micrófono ni por sala: mide el análisis, no el entorno.
import { chordCandidates } from "../../src/audio/dsp/chordRecognizer";
import { GuitarListener, type ListenerEvent } from "../../src/audio/listening/guitarListener";
import { ChordScoreFollower, MelodyFollower } from "../../src/audio/listening/scoreFollower";
import { guitarSampleName, onsetOffset } from "../../src/audio/guitar/sampleBank";

const RATE = 44100;
const OPEN = [40, 45, 50, 55, 59, 64];
// Formas de los acordes, de la sexta a la primera cuerda; -1 no suena.
const SHAPES: Record<string, number[]> = {
  G: [3, 2, 0, 0, 0, 3],
  D: [-1, -1, 0, 2, 3, 2],
  Em: [0, 2, 2, 0, 0, 0],
  C: [-1, 3, 2, 0, 1, 0],
  Am: [-1, 0, 2, 2, 1, 0],
  E: [0, 2, 2, 1, 0, 0],
  A: [-1, 0, 2, 2, 2, 0],
};

async function loadNote(context: OfflineAudioContext, midi: number): Promise<AudioBuffer> {
  const response = await fetch(`/samples/guitar-steel/${guitarSampleName(midi)}.mp3`);
  return context.decodeAudioData(await response.arrayBuffer());
}

interface Hit {
  midis: number[];
  at: number;
  /** Segundos entre la primera y la última cuerda del rasgueo. */
  spread: number;
  hold: number;
}

async function render(hits: Hit[], length: number, noise: number): Promise<Float32Array> {
  const context = new OfflineAudioContext(1, Math.ceil(length * RATE), RATE);
  const buffers = new Map<number, AudioBuffer>();
  const offsets = new Map<number, number>();
  for (const midi of new Set(hits.flatMap((hit) => hit.midis))) {
    const buffer = await loadNote(context, midi);
    buffers.set(midi, buffer);
    // El MP3 trae silencio antes del ataque: sin quitarlo, cada nota llegaría tarde.
    offsets.set(midi, onsetOffset(buffer.getChannelData(0), buffer.sampleRate));
  }
  for (const hit of hits) {
    hit.midis.forEach((midi, index) => {
      const source = context.createBufferSource();
      source.buffer = buffers.get(midi) as AudioBuffer;
      const gain = context.createGain();
      const start = hit.at + (hit.spread * index) / Math.max(1, hit.midis.length - 1);
      gain.gain.setValueAtTime(0.28, start);
      // La mano apaga las cuerdas al cambiar de acorde, pero no al instante.
      gain.gain.setTargetAtTime(0.0001, start + hit.hold, 0.03);
      source.connect(gain);
      gain.connect(context.destination);
      source.start(start, offsets.get(midi));
    });
  }
  const rendered = await context.startRendering();
  const samples = rendered.getChannelData(0);
  // Ruido de sala determinista, para que el resultado se pueda repetir.
  let seed = 12345;
  for (let index = 0; index < samples.length; index += 1) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    samples[index] += ((seed / 4294967296) * 2 - 1) * noise;
  }
  return samples;
}

function run(samples: Float32Array, options: { chords: boolean; notes: boolean }) {
  const events: ListenerEvent[] = [];
  const listener = new GuitarListener(RATE, (event) => events.push(event), options);
  const started = performance.now();
  // Los bloques de 128 muestras son los que entrega un AudioWorklet.
  for (let start = 0; start < samples.length; start += 128) {
    listener.feed(samples.subarray(start, start + 128), start === 0 ? 0 : start);
  }
  const seconds = (performance.now() - started) / 1000;
  return { events, realtimeFactor: samples.length / RATE / seconds };
}

function shapeMidis(symbol: string): number[] {
  return SHAPES[symbol].flatMap((fret, string) => (fret < 0 ? [] : [OPEN[string] + fret]));
}

export interface ChordBenchResult {
  bpm: number;
  beatsPerChord: number;
  slots: number;
  correct: number;
  accuracy: number;
  onsetRecall: number;
  medianOnsetErrorMs: number;
  realtimeFactor: number;
}

/** Toca una progresión y cuenta los tramos acertados, sin decirle al oyente cuál es correcto. */
export async function chordBench(
  progression: string[],
  bpm: number,
  beatsPerChord: number,
  noise = 0.002,
): Promise<ChordBenchResult> {
  const beat = 60 / bpm;
  const lengthPerChord = beat * beatsPerChord;
  const lead = 0.5;
  const hits: Hit[] = progression.map((symbol, index) => ({
    midis: shapeMidis(symbol),
    at: lead + index * lengthPerChord,
    spread: Math.min(0.02, lengthPerChord * 0.15),
    hold: lengthPerChord * 0.9,
  }));
  const samples = await render(hits, lead + progression.length * lengthPerChord + 1, noise);
  const { events, realtimeFactor } = run(samples, { chords: true, notes: false });
  const follower = new ChordScoreFollower(
    progression.map((symbol, index) => ({
      symbol,
      at: lead + index * lengthPerChord,
      end: lead + (index + 1) * lengthPerChord,
    })),
    (symbol) => chordCandidates(symbol, progression),
  );
  const onsets: number[] = [];
  for (const event of events) {
    if (event.type === "onset") {
      onsets.push(event.at);
      follower.addOnset(event.at);
    } else if (event.type === "chord") {
      follower.addChroma(event.onsetAt, event.at, event.windowSize, event.chroma);
    }
  }
  let correct = 0;
  progression.forEach((_symbol, index) => {
    if (follower.result(index).judgement.ok) {
      correct += 1;
    }
  });
  const errors = hits
    .map((hit) => Math.min(...onsets.map((onset) => Math.abs(onset - hit.at))))
    .sort((left, right) => left - right);
  const tolerance = Math.max(0.03, Math.min(0.05, lengthPerChord / 3));
  return {
    bpm,
    beatsPerChord,
    slots: progression.length,
    correct,
    accuracy: correct / progression.length,
    onsetRecall: errors.filter((error) => error <= tolerance).length / hits.length,
    medianOnsetErrorMs: Math.round(errors[Math.floor(errors.length / 2)] * 1000),
    realtimeFactor,
  };
}

/** ¿Distingue el acorde tocado de uno que no es? Toca `played` y lo evalúa contra `expected`. */
export async function wrongChordBench(
  played: string[],
  expected: string[],
  bpm: number,
  beatsPerChord: number,
): Promise<{ accepted: number; slots: number }> {
  const lengthPerChord = (60 / bpm) * beatsPerChord;
  const lead = 0.5;
  const samples = await render(
    played.map((symbol, index) => ({
      midis: shapeMidis(symbol),
      at: lead + index * lengthPerChord,
      spread: Math.min(0.02, lengthPerChord * 0.15),
      hold: lengthPerChord * 0.9,
    })),
    lead + played.length * lengthPerChord + 1,
    0.002,
  );
  const { events } = run(samples, { chords: true, notes: false });
  const follower = new ChordScoreFollower(
    expected.map((symbol, index) => ({
      symbol,
      at: lead + index * lengthPerChord,
      end: lead + (index + 1) * lengthPerChord,
    })),
    (symbol) => chordCandidates(symbol, expected),
  );
  for (const event of events) {
    if (event.type === "chord") {
      follower.addChroma(event.onsetAt, event.at, event.windowSize, event.chroma);
    }
  }
  return {
    accepted: expected.filter((_symbol, index) => follower.result(index).judgement.ok).length,
    slots: expected.length,
  };
}

export interface MelodyBenchResult {
  bpm: number;
  notesPerBeat: number;
  notes: number;
  heard: number;
  correct: number;
  followerAccuracy: number;
  realtimeFactor: number;
}

/** Toca una melodía nota por nota y mide cuántas reconoce en orden. */
export async function melodyBench(
  melody: number[],
  bpm: number,
  notesPerBeat: number,
): Promise<MelodyBenchResult> {
  const step = 60 / bpm / notesPerBeat;
  const lead = 0.5;
  const samples = await render(
    melody.map((midi, index) => ({
      midis: [midi],
      at: lead + index * step,
      spread: 0,
      hold: step * 0.95,
    })),
    lead + melody.length * step + 1,
    0.001,
  );
  const { events, realtimeFactor } = run(samples, { chords: false, notes: true });
  const notes = events.flatMap((event) => (event.type === "note" ? [event] : []));
  const follower = new MelodyFollower(melody);
  for (const note of notes) {
    follower.hear(note.midi);
  }
  const correct = melody.filter((midi, index) => {
    const at = lead + index * step;
    return notes.some(
      (note) =>
        Math.abs(note.at - at) < Math.max(0.04, step * 0.6) && (note.midi - midi) % 12 === 0,
    );
  }).length;
  return {
    bpm,
    notesPerBeat,
    notes: melody.length,
    heard: notes.length,
    correct,
    followerAccuracy: follower.accuracy(),
    realtimeFactor,
  };
}
