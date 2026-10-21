import { rms } from "../dsp/gate";
import { noteFromFrequency, type NoteReading } from "../dsp/noteMath";
import { yinPitch } from "../dsp/yin";
import { pushSamples } from "../worklets/capture.worklet";

const WINDOW = 4096;
const SILENCE_RMS = 0.012;
const MIN_HZ = 60;
const MAX_HZ = 1200;
const STABLE_FRAMES = 5;

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

export async function startPitchMonitor(
  stream: MediaStream,
  onReading: (reading: NoteReading | null) => void,
): Promise<() => void> {
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const mute = context.createGain();
  mute.gain.value = 0;
  const pending: number[] = [];
  const history: number[] = [];

  const consume = (input: ArrayLike<number>) => {
    const chunk = pushSamples(pending, input, WINDOW);
    if (!chunk) {
      return;
    }
    const frequency = frequencyFromChunk(chunk, context.sampleRate);
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
  };

  let worklet: AudioWorkletNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  try {
    await context.audioWorklet.addModule(
      new URL("../worklets/capture.worklet.ts", import.meta.url),
    );
    worklet = new AudioWorkletNode(context, "capture");
    worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
      consume(event.data);
    };
    source.connect(worklet);
    worklet.connect(mute);
  } catch {
    processor = context.createScriptProcessor(WINDOW, 1, 1);
    processor.onaudioprocess = (event) => {
      consume(event.inputBuffer.getChannelData(0));
    };
    source.connect(processor);
    processor.connect(mute);
  }
  mute.connect(context.destination);
  if (context.state === "suspended") {
    await context.resume();
  }

  return () => {
    worklet?.disconnect();
    processor?.disconnect();
    source.disconnect();
    mute.disconnect();
    for (const track of stream.getTracks()) {
      track.stop();
    }
    void context.close();
  };
}
