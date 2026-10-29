import { trackLoading } from "./loadingStatus";

const PITCHES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const LOWEST = 21;
const HIGHEST = 108;

export interface GuitarSample {
  buffer: AudioBuffer;
  /** Segundos de silencio al inicio del archivo; el MP3 agrega relleno antes del ataque. */
  offset: number;
}

type Fetcher = (url: string) => Promise<Response>;

function clampMidi(midi: number): number {
  return Math.min(HIGHEST, Math.max(LOWEST, Math.round(midi)));
}

export function guitarSampleName(midi: number): string {
  const note = clampMidi(midi);
  const pitch = PITCHES[note % 12];
  const octave = Math.floor(note / 12) - 1;
  return `${pitch}${octave}`;
}

/** Primer instante en que la señal supera el 5 % de su pico, con 2 ms de margen. */
export function onsetOffset(channel: Float32Array, sampleRate: number): number {
  let peak = 0;
  for (const value of channel) {
    peak = Math.max(peak, Math.abs(value));
  }
  if (peak === 0) {
    return 0;
  }
  const threshold = peak * 0.05;
  const first = channel.findIndex((value) => Math.abs(value) >= threshold);
  const margin = Math.round(sampleRate * 0.002);
  return Math.max(0, first - margin) / sampleRate;
}

export class SampleBank {
  private readonly files = new Map<number, Promise<ArrayBuffer | null>>();
  private readonly decoded = new Map<number, Promise<GuitarSample | null>>();

  constructor(
    private readonly roots: readonly string[],
    private readonly fetcher: Fetcher = (url) => fetch(url),
  ) {}

  /** Descarga sin decodificar: no necesita un AudioContext ni un gesto del usuario. */
  prefetch(midis: number[]): void {
    for (const midi of midis) {
      void this.file(clampMidi(midi));
    }
  }

  async loadAll(context: BaseAudioContext, midis: number[]): Promise<Map<number, GuitarSample>> {
    const notes = [...new Set(midis.map(clampMidi))];
    const cold = notes.some((note) => !this.decoded.has(note));
    const work = Promise.all(notes.map((note) => this.sample(context, note)));
    const loaded = await (cold ? trackLoading(work) : work);
    const found = new Map<number, GuitarSample>();
    notes.forEach((note, index) => {
      const sample = loaded[index];
      if (sample) {
        found.set(note, sample);
      }
    });
    // Las notas pedidas fuera de rango usan la muestra del extremo más cercano.
    for (const midi of midis) {
      const sample = found.get(clampMidi(midi));
      if (sample) {
        found.set(midi, sample);
      }
    }
    return found;
  }

  private sample(context: BaseAudioContext, note: number): Promise<GuitarSample | null> {
    const cached = this.decoded.get(note);
    if (cached) {
      return cached;
    }
    const pending = this.file(note)
      .then(async (bytes) => {
        if (!bytes) {
          return null;
        }
        const buffer = await context.decodeAudioData(bytes.slice(0));
        return { buffer, offset: onsetOffset(buffer.getChannelData(0), buffer.sampleRate) };
      })
      .catch(() => null);
    this.decoded.set(note, pending);
    return pending;
  }

  private file(note: number): Promise<ArrayBuffer | null> {
    const cached = this.files.get(note);
    if (cached) {
      return cached;
    }
    const pending = this.firstAvailable(`${guitarSampleName(note)}.mp3`);
    this.files.set(note, pending);
    return pending;
  }

  private async firstAvailable(name: string): Promise<ArrayBuffer | null> {
    for (const root of this.roots) {
      try {
        const response = await this.fetcher(`${root}/${name}`);
        // Vite responde index.html con 200 cuando el archivo no existe en public/.
        const type = response.headers.get("content-type") ?? "";
        if (response.ok && !type.includes("text/html")) {
          return await response.arrayBuffer();
        }
      } catch {
        /* se prueba la siguiente fuente */
      }
    }
    return null;
  }
}
