import { rms } from "../dsp/gate";
import { noteFromFrequency, type NoteReading } from "../dsp/noteMath";
import { yinPitch } from "../dsp/yin";
import { Metronome } from "../guitar/metronome";
import {
  GuitarListener,
  type ListenerEvent,
  type ListenerOptions,
} from "../listening/guitarListener";
import { pushSamples, type CapturedChunk } from "../worklets/capture.worklet";

const WINDOW = 4096;
const SILENCE_RMS = 0.012;
const MIN_HZ = 60;
const MAX_HZ = 1200;
const STABLE_FRAMES = 5;

/**
 * Pensados para la voz, estos filtros del navegador se comen el ataque y el final de cada nota:
 * el supresor de ruido toma la guitarra por ruido y el control de ganancia aplana los rasgueos.
 */
export const GUITAR_MIC: MediaStreamConstraints = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
};

export function frequencyFromChunk(samples: Float32Array, sampleRate: number): number | null {
  if (rms(samples) < SILENCE_RMS) {
    return null;
  }
  const frequency = yinPitch(samples, sampleRate);
  if (frequency === null || frequency < MIN_HZ || frequency > MAX_HZ) {
    return null;
  }
  return frequency;
}

export function readingFromChunk(samples: Float32Array, sampleRate: number): NoteReading | null {
  const frequency = frequencyFromChunk(samples, sampleRate);
  return frequency === null ? null : noteFromFrequency(frequency);
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/** Suelta el micrófono: mientras una pista siga viva, el navegador lo muestra encendido. */
export function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

interface Capture {
  context: AudioContext;
  stop: () => void;
}

/** Abre la captura del micrófono y entrega cada bloque con su posición en el reloj de audio. */
async function startCapture(
  stream: MediaStream,
  onChunk: (samples: Float32Array, frame: number, sampleRate: number) => void,
): Promise<Capture> {
  const context = new AudioContext({ latencyHint: "interactive" });
  const source = context.createMediaStreamSource(stream);
  const mute = context.createGain();
  mute.gain.value = 0;

  let worklet: AudioWorkletNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  try {
    await context.audioWorklet.addModule(
      new URL("../worklets/capture.worklet.ts", import.meta.url),
    );
    worklet = new AudioWorkletNode(context, "capture");
    worklet.port.onmessage = (event: MessageEvent<CapturedChunk>) => {
      onChunk(event.data.samples, event.data.frame, context.sampleRate);
    };
    source.connect(worklet);
    worklet.connect(mute);
  } catch {
    processor = context.createScriptProcessor(1024, 1, 1);
    processor.onaudioprocess = (event) => {
      onChunk(
        event.inputBuffer.getChannelData(0).slice(),
        Math.round(event.playbackTime * context.sampleRate),
        context.sampleRate,
      );
    };
    source.connect(processor);
    processor.connect(mute);
  }
  mute.connect(context.destination);
  if (context.state === "suspended") {
    await context.resume();
  }

  return {
    context,
    stop: () => {
      worklet?.disconnect();
      processor?.disconnect();
      source.disconnect();
      mute.disconnect();
      stopTracks(stream);
      void context.close();
    },
  };
}

export async function startPitchMonitor(
  stream: MediaStream,
  onReading: (reading: NoteReading | null) => void,
): Promise<() => void> {
  const history: number[] = [];
  const pending: number[] = [];
  const capture = await startCapture(stream, (samples, _frame, sampleRate) => {
    const chunk = pushSamples(pending, samples, WINDOW);
    if (!chunk) {
      return;
    }
    const frequency = frequencyFromChunk(chunk, sampleRate);
    if (frequency === null) {
      history.length = 0;
      onReading(null);
      return;
    }
    history.push(frequency);
    if (history.length > STABLE_FRAMES) {
      history.shift();
    }
    onReading(noteFromFrequency(median(history)));
  });
  return capture.stop;
}

export interface ListeningSession {
  /** Segundos del reloj de audio: el mismo que marcan los eventos del oyente. */
  now: () => number;
  /** Lo que tarda un sonido en ir del altavoz a la app pasando por el micrófono. */
  latency: number;
  click: (at: number, accent: boolean) => void;
  stop: () => void;
}

function roundTripLatency(context: AudioContext, stream: MediaStream): number {
  const input = stream.getAudioTracks()[0]?.getSettings?.() as { latency?: number } | undefined;
  return (context.outputLatency || 0) + (input?.latency ?? context.baseLatency ?? 0);
}

/** Abre la escucha continua de la guitarra. */
export async function startGuitarListener(
  stream: MediaStream,
  options: ListenerOptions,
  onEvent: (event: ListenerEvent) => void,
): Promise<ListeningSession> {
  let listener: GuitarListener | null = null;
  const capture = await startCapture(stream, (samples, frame, sampleRate) => {
    listener ??= new GuitarListener(sampleRate, onEvent, options);
    listener.feed(samples, frame);
  });
  const metronome = new Metronome(capture.context, capture.context.destination);
  return {
    now: () => capture.context.currentTime,
    latency: roundTripLatency(capture.context, stream),
    click: (at, accent) => metronome.click(at, accent),
    stop: () => {
      metronome.stopAll();
      capture.stop();
    },
  };
}
