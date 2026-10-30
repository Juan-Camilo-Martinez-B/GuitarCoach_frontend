import type { GuitarSample } from "./sampleBank";
import type { NoteStrike } from "./strumPerformer";

export const STRING_COUNT = 6;

// Constantes de tiempo de setTargetAtTime: llega al 95 % en tres veces este valor.
const CHOKE_TIME = 0.012;
const RELEASE_TIME = 0.08;
const MUTED_RING = 0.05;
const ATTACK = 0.003;
const MAX_GAIN = 0.32;

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  startsAt: number;
  endsAt: number;
}

export interface StrikeOptions {
  /** Cuánto suena como máximo si nada la apaga antes. */
  ring: number;
  detuneCents?: number;
}

export function strikeGain(velocity: number, muted: boolean): number {
  return MAX_GAIN * Math.pow(velocity, 1.5) * (muted ? 0.7 : 1);
}

/** Golpe suave, sonido opaco; golpe fuerte, más brillo. */
export function strikeBrightness(velocity: number, muted: boolean): number {
  return muted ? 900 : 1600 + 7400 * Math.pow(velocity, 1.2);
}

export class StringVoices {
  private readonly current: Array<Voice | null> = Array.from({ length: STRING_COUNT }, () => null);
  private readonly voices = new Set<Voice>();

  constructor(
    private readonly context: BaseAudioContext,
    private readonly destination: AudioNode,
  ) {}

  strike(note: NoteStrike, sample: GuitarSample, options: StrikeOptions): void {
    const { context } = this;
    const at = Math.max(note.at, context.currentTime);
    this.damp(note.string, at);

    const source = context.createBufferSource();
    source.buffer = sample.buffer;
    source.detune.value = options.detuneCents ?? 0;

    const tone = context.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = strikeBrightness(note.velocity, note.muted);
    tone.Q.value = 0.7;

    const gain = context.createGain();
    gain.gain.value = 0;
    const peak = strikeGain(note.velocity, note.muted);
    const playable = Math.max(0.01, sample.buffer.duration - sample.offset);
    const ring = Math.min(note.muted ? MUTED_RING : options.ring, playable);
    const endsAt = at + ring;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + ATTACK);
    gain.gain.setTargetAtTime(0, endsAt, note.muted ? CHOKE_TIME : RELEASE_TIME);

    source.connect(tone);
    tone.connect(gain);
    gain.connect(this.destination);
    source.start(at, sample.offset);
    source.stop(endsAt + (note.muted ? CHOKE_TIME : RELEASE_TIME) * 6);

    const voice: Voice = { source, gain, startsAt: at, endsAt };
    this.current[note.string] = voice;
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      if (this.current[note.string] === voice) {
        this.current[note.string] = null;
      }
      gain.disconnect();
    };
  }

  /** Apaga la cuerda en un instante, como el dedo o la palma al tocarla. */
  damp(string: number, at: number): void {
    const voice = this.current[string];
    if (!voice || voice.endsAt <= at) {
      return;
    }
    this.silence(voice, Math.max(at, voice.startsAt), CHOKE_TIME);
    this.current[string] = null;
  }

  /** Deja sonar lo que ya empezó y cancela lo que estaba programado para después. */
  cancelAfter(time: number): void {
    for (const voice of this.voices) {
      if (voice.startsAt > time) {
        this.silence(voice, voice.startsAt, CHOKE_TIME);
      }
    }
  }

  stopAll(): void {
    const now = this.context.currentTime;
    for (const voice of this.voices) {
      this.silence(voice, Math.max(now, voice.startsAt), CHOKE_TIME * 2);
    }
    this.current.fill(null);
  }

  private silence(voice: Voice, at: number, timeConstant: number): void {
    try {
      if (at <= voice.startsAt) {
        // Todavía no empezó: basta con que nunca arranque.
        voice.source.stop(voice.startsAt);
        voice.endsAt = voice.startsAt;
        return;
      }
      voice.gain.gain.cancelScheduledValues(at);
      if (at <= this.context.currentTime) {
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, at);
      }
      voice.gain.gain.setTargetAtTime(0, at, timeConstant);
      voice.endsAt = at;
      voice.source.stop(at + timeConstant * 8);
    } catch {
      /* la nota ya terminó */
    }
  }
}
