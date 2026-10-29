import { seededRandom, type Random } from "./random";

const ROOM_SECONDS = 1.1;
const ROOM_PREDELAY = 0.008;
const ROOM_WET = 0.14;

/** Cola de sala: ruido que decae, cada vez más opaco, para no sonar metálico. */
export function roomImpulse(
  length: number,
  sampleRate: number,
  random: Random,
): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(new ArrayBuffer(length * Float32Array.BYTES_PER_ELEMENT));
  const predelay = Math.round(sampleRate * ROOM_PREDELAY);
  let smooth = 0;
  for (let index = predelay; index < length; index += 1) {
    const progress = (index - predelay) / Math.max(1, length - predelay);
    const decay = Math.pow(1 - progress, 3.2);
    const softness = 0.35 + 0.6 * progress;
    smooth += (random() * 2 - 1 - smooth) * (1 - softness);
    samples[index] = smooth * decay;
  }
  return samples;
}

function room(context: BaseAudioContext): ConvolverNode {
  const length = Math.round(context.sampleRate * ROOM_SECONDS);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    buffer.copyToChannel(
      roomImpulse(length, context.sampleRate, seededRandom(97 + channel)),
      channel,
    );
  }
  const convolver = context.createConvolver();
  convolver.buffer = buffer;
  return convolver;
}

function peaking(context: BaseAudioContext, frequency: number, gain: number, q: number) {
  const filter = context.createBiquadFilter();
  filter.type = "peaking";
  filter.frequency.value = frequency;
  filter.gain.value = gain;
  filter.Q.value = q;
  return filter;
}

function compressor(
  context: BaseAudioContext,
  settings: { threshold: number; knee: number; ratio: number; attack: number; release: number },
) {
  const node = context.createDynamicsCompressor();
  node.threshold.value = settings.threshold;
  node.knee.value = settings.knee;
  node.ratio.value = settings.ratio;
  node.attack.value = settings.attack;
  node.release.value = settings.release;
  return node;
}

/**
 * Todo lo que suena pasa por aquí: caja de la guitarra, sala corta,
 * compresión suave y un limitador para que seis cuerdas juntas no saturen.
 */
export function createOutputChain(context: BaseAudioContext): AudioNode {
  const input = context.createGain();
  const body = peaking(context, 110, 3, 1.2);
  const presence = peaking(context, 2500, 1.5, 0.9);
  const reverb = room(context);
  const wet = context.createGain();
  wet.gain.value = ROOM_WET;
  const glue = compressor(context, {
    threshold: -20,
    knee: 12,
    ratio: 3,
    attack: 0.004,
    release: 0.2,
  });
  const limiter = compressor(context, {
    threshold: -3,
    knee: 0,
    ratio: 20,
    attack: 0.001,
    release: 0.1,
  });
  const master = context.createGain();
  master.gain.value = 0.9;

  input.connect(body);
  body.connect(presence);
  presence.connect(glue);
  presence.connect(reverb);
  reverb.connect(wet);
  wet.connect(glue);
  glue.connect(limiter);
  limiter.connect(master);
  master.connect(context.destination);
  return input;
}
