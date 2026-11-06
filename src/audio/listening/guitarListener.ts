import { chromaFromSpectrum } from "../dsp/chordRecognizer";
import { hannSpectrum } from "../dsp/fft";
import { rms } from "../dsp/gate";
import { midiFromFrequency } from "../dsp/noteMath";
import { yinDetect } from "../dsp/yin";

/** Algo empezó a sonar: un rasgueo o una nota. `at` va en segundos del reloj de audio. */
export interface OnsetEvent {
  type: "onset";
  at: number;
  strength: number;
}

/** Lo que suena desde el último ataque. Las ventanas crecen mientras no llegue otro. */
export interface ChordFrameEvent {
  type: "chord";
  onsetAt: number | null;
  at: number;
  windowSize: number;
  chroma: Float32Array;
}

export interface NoteEvent {
  type: "note";
  at: number;
  midi: number;
  cents: number;
  confidence: number;
}

export type ListenerEvent = OnsetEvent | ChordFrameEvent | NoteEvent;

export interface ListenerOptions {
  chords: boolean;
  notes: boolean;
}

// Los rasgueos se miden con ventana larga; las notas sueltas rápidas necesitan una más corta.
const CHORD_GRID = { hop: 512, frame: 2048, minGapSeconds: 0.05 };
const NOTE_GRID = { hop: 256, frame: 1024, minGapSeconds: 0.03 };
const RING = 32768;
const SILENCE_RMS = 0.004;
// Compresión del espectro: un rasgueo suave y uno fuerte deben verse parecidos.
const LOG_GAIN = 4000;
const FLUX_LOW_HZ = 60;
const FLUX_HIGH_HZ = 6000;
const FLUX_HISTORY = 24;
const FLUX_RATIO = 1.7;
const FLUX_FLOOR = 0.012;
const PEAK_MEMORY = 0.12;
const PEAK_DECAY = 0.92;
// Soltar o apagar las cuerdas también sacude el espectro, pero el sonido baja: no es un ataque.
const MIN_LOUDNESS_RISE = 0.9;
// El flujo máximo aparece cuando el ataque ya entró una parte de la ventana de Hann.
const ONSET_BIAS_SHARE = 0.32;
// Se salta el golpe de la púa: es ruido sin nota.
const ATTACK_SKIP_SECONDS = 0.006;
const CHORD_WINDOWS = [2048, 4096, 8192] as const;
// Lo que ya sonaba antes del ataque se resta: al cambiar rápido, el acorde anterior sigue vibrando.
const CARRYOVER = 0.75;
const SUSTAIN_AFTER_SECONDS = 0.25;
const SUSTAIN_WINDOW = 8192;
const SUSTAIN_HOP = 4096;
const SUSTAIN_LOUDNESS = SILENCE_RMS * 2.5;
const NOTE_WINDOW = 1536;
const NOTE_MAX_APERIODICITY = 0.25;
const LEGATO_CHECK_HOPS = 2;
const LEGATO_MIN_SEMITONES = 0.75;
const LEGATO_STABLE_CHECKS = 2;

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function nearestNote(frequency: number): { midi: number; cents: number } {
  const exact = midiFromFrequency(frequency);
  const midi = Math.round(exact);
  return { midi, cents: Math.round((exact - midi) * 100) };
}

interface PendingOnset {
  sample: number;
  windows: number[];
  noted: boolean;
}

/**
 * Escucha continua de la guitarra. Trabaja sobre el contador de muestras, no sobre el reloj del
 * navegador: aunque la pantalla se trabe, cada ataque conserva su instante exacto.
 */
export class GuitarListener {
  private readonly ring = new Float32Array(RING);
  private total = 0;
  private firstFrame: number | null = null;
  private nextHop: number;
  private previousLog: Float32Array | null = null;
  private readonly fluxes: number[] = [];
  private fluxBefore = 0;
  private fluxPeak = 0;
  private loudBefore = 0;
  private loudEarlier = 0;
  private lastOnset = -Infinity;
  private pending: PendingOnset | null = null;
  private nextSustain = 0;
  private hopsSinceLegato = 0;
  private currentMidi: number | null = null;
  private legatoMidi: number | null = null;
  private legatoCount = 0;
  private readonly hop: number;
  private readonly frameSize: number;
  private readonly onsetBias: number;
  private readonly fluxLowBin: number;
  private readonly fluxHighBin: number;
  private readonly minGap: number;
  private readonly attackSkip: number;

  constructor(
    private readonly sampleRate: number,
    private readonly emit: (event: ListenerEvent) => void,
    private readonly options: ListenerOptions = { chords: true, notes: false },
  ) {
    // Con los dos análisis activos manda el de acordes: un rasgueo no debe partirse en notas.
    const grid = options.chords ? CHORD_GRID : NOTE_GRID;
    this.hop = grid.hop;
    this.frameSize = grid.frame;
    this.nextHop = grid.frame;
    this.onsetBias = Math.round(grid.frame * ONSET_BIAS_SHARE);
    this.fluxLowBin = Math.max(1, Math.floor((FLUX_LOW_HZ * grid.frame) / sampleRate));
    this.fluxHighBin = Math.min(
      grid.frame / 2 - 1,
      Math.ceil((FLUX_HIGH_HZ * grid.frame) / sampleRate),
    );
    this.minGap = Math.round(grid.minGapSeconds * sampleRate);
    this.attackSkip = Math.round(ATTACK_SKIP_SECONDS * sampleRate);
  }

  /** `frame` es la posición de la primera muestra en el reloj de audio. */
  feed(samples: ArrayLike<number>, frame = 0): void {
    if (this.firstFrame === null) {
      this.firstFrame = frame;
    }
    for (let index = 0; index < samples.length; index += 1) {
      this.ring[(this.total + index) % RING] = samples[index];
    }
    this.total += samples.length;
    while (this.total >= this.nextHop) {
      this.analyzeHop(this.nextHop);
      this.nextHop += this.hop;
    }
    this.flushWindows(this.total);
  }

  private seconds(sample: number): number {
    return ((this.firstFrame ?? 0) + sample) / this.sampleRate;
  }

  private slice(end: number, size: number): Float32Array | null {
    const start = end - size;
    if (start < 0 || start < this.total - RING || end > this.total) {
      return null;
    }
    const out = new Float32Array(size);
    for (let index = 0; index < size; index += 1) {
      out[index] = this.ring[(start + index) % RING];
    }
    return out;
  }

  private analyzeHop(end: number): void {
    const frame = this.slice(end, this.frameSize);
    if (!frame) {
      return;
    }
    const loud = rms(frame);
    this.pickOnset(loud < SILENCE_RMS ? this.silentFlux() : this.spectralFlux(frame), end, loud);
    if (this.options.chords) {
      this.emitSustain(end, loud);
    }
    if (this.options.notes) {
      this.followLegato(end, loud);
    }
  }

  private silentFlux(): number {
    this.previousLog = null;
    return 0;
  }

  private spectralFlux(frame: Float32Array): number {
    const magnitudes = hannSpectrum(frame);
    const log = new Float32Array(this.fluxHighBin - this.fluxLowBin + 1);
    const scale = LOG_GAIN / this.frameSize;
    let flux = 0;
    for (let index = 0; index < log.length; index += 1) {
      log[index] = Math.log1p(scale * magnitudes[this.fluxLowBin + index]);
      if (this.previousLog) {
        flux += Math.max(0, log[index] - this.previousLog[index]);
      }
    }
    // Salir del silencio también es un ataque: todo lo que suena es nuevo.
    if (!this.previousLog) {
      flux = log.reduce((sum, value) => sum + value, 0);
    }
    this.previousLog = log;
    return flux / log.length;
  }

  /** Un ataque es un pico del flujo que sobresale de lo reciente. Se confirma un salto después. */
  private pickOnset(flux: number, end: number, loud: number): void {
    const candidate = this.fluxBefore;
    const threshold = median(this.fluxes) * FLUX_RATIO + FLUX_FLOOR + this.fluxPeak * PEAK_MEMORY;
    this.fluxPeak *= PEAK_DECAY;
    const sample = end - this.hop - this.onsetBias;
    const previous = this.fluxes[this.fluxes.length - 1] ?? 0;
    if (
      candidate > threshold &&
      candidate >= flux &&
      candidate >= previous &&
      loud >= this.loudEarlier * MIN_LOUDNESS_RISE &&
      sample - this.lastOnset >= this.minGap
    ) {
      this.fluxPeak = Math.max(this.fluxPeak, candidate);
      this.startOnset(sample, candidate);
    }
    this.fluxes.push(candidate);
    if (this.fluxes.length > FLUX_HISTORY) {
      this.fluxes.shift();
    }
    this.fluxBefore = flux;
    this.loudEarlier = this.loudBefore;
    this.loudBefore = loud;
  }

  private startOnset(sample: number, strength: number): void {
    // Lo que ya alcanzó a oírse del ataque anterior se analiza antes de pasar al nuevo.
    this.flushWindows(sample);
    this.lastOnset = sample;
    this.currentMidi = null;
    this.legatoMidi = null;
    this.legatoCount = 0;
    this.pending = { sample, windows: [...CHORD_WINDOWS], noted: false };
    this.emit({ type: "onset", at: this.seconds(sample), strength });
  }

  /** Analiza las ventanas ya completas del último ataque, sin pasar de `limit`. */
  private flushWindows(limit: number): void {
    const pending = this.pending;
    if (!pending) {
      return;
    }
    const start = pending.sample + this.attackSkip;
    if (this.options.notes && !pending.noted && limit >= start + NOTE_WINDOW) {
      // Si el ataque todavía no da una altura clara, se reintenta con lo que siga llegando.
      pending.noted = this.emitNote(pending.sample, limit);
    }
    if (this.options.chords) {
      while (pending.windows.length > 0 && start + pending.windows[0] <= limit) {
        this.emitChord(pending.sample, start, pending.windows.shift() as number);
      }
    }
  }

  private emitChord(onset: number, start: number, size: number): void {
    const after = this.slice(start + size, size);
    if (!after || rms(after) < SILENCE_RMS) {
      return;
    }
    const spectrum = hannSpectrum(after);
    const before = this.slice(onset, size);
    if (before) {
      const old = hannSpectrum(before);
      for (let bin = 0; bin < spectrum.length; bin += 1) {
        spectrum[bin] = Math.max(0, spectrum[bin] - CARRYOVER * old[bin]);
      }
    }
    const chroma = chromaFromSpectrum(spectrum, this.sampleRate, size);
    if (chroma) {
      this.emit({
        type: "chord",
        onsetAt: this.seconds(onset),
        at: this.seconds(start + size),
        windowSize: size,
        chroma,
      });
    }
  }

  private emitSustain(end: number, loud: number): void {
    if (
      end - this.lastOnset < SUSTAIN_AFTER_SECONDS * this.sampleRate ||
      end < this.nextSustain ||
      loud < SUSTAIN_LOUDNESS
    ) {
      return;
    }
    this.nextSustain = end + SUSTAIN_HOP;
    const samples = this.slice(end, SUSTAIN_WINDOW);
    const chroma = samples
      ? chromaFromSpectrum(hannSpectrum(samples), this.sampleRate, SUSTAIN_WINDOW)
      : null;
    if (chroma) {
      this.emit({
        type: "chord",
        onsetAt: null,
        at: this.seconds(end),
        windowSize: SUSTAIN_WINDOW,
        chroma,
      });
    }
  }

  private emitNote(onset: number, end: number): boolean {
    const samples = this.slice(end, NOTE_WINDOW);
    const found = samples ? yinDetect(samples, this.sampleRate, NOTE_MAX_APERIODICITY) : null;
    if (!found) {
      return false;
    }
    const note = nearestNote(found.frequency);
    this.currentMidi = note.midi;
    this.emit({
      type: "note",
      at: this.seconds(onset),
      ...note,
      confidence: 1 - found.aperiodicity,
    });
    return true;
  }

  /** Ligados y slides cambian la nota sin ataque: se notan porque la altura salta y se queda. */
  private followLegato(end: number, loud: number): void {
    this.hopsSinceLegato += 1;
    if (
      this.hopsSinceLegato < LEGATO_CHECK_HOPS ||
      loud < SILENCE_RMS * 2 ||
      end - this.lastOnset < this.minGap + NOTE_WINDOW
    ) {
      return;
    }
    this.hopsSinceLegato = 0;
    const window = this.slice(end, NOTE_WINDOW);
    const found = window ? yinDetect(window, this.sampleRate, NOTE_MAX_APERIODICITY) : null;
    if (!found) {
      return;
    }
    const exact = midiFromFrequency(found.frequency);
    const midi = Math.round(exact);
    if (this.currentMidi !== null && Math.abs(exact - this.currentMidi) < LEGATO_MIN_SEMITONES) {
      this.legatoMidi = null;
      this.legatoCount = 0;
      return;
    }
    this.legatoCount = this.legatoMidi === midi ? this.legatoCount + 1 : 1;
    this.legatoMidi = midi;
    if (this.currentMidi !== null && this.legatoCount < LEGATO_STABLE_CHECKS) {
      return;
    }
    this.currentMidi = midi;
    this.legatoMidi = null;
    this.legatoCount = 0;
    this.lastOnset = end - NOTE_WINDOW;
    this.emit({
      type: "note",
      at: this.seconds(end - NOTE_WINDOW),
      ...nearestNote(found.frequency),
      confidence: 1 - found.aperiodicity,
    });
  }
}
