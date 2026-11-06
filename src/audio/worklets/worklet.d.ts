declare class AudioWorkletProcessor {
  readonly port: { postMessage(data: unknown): void };
  process(inputs: Float32Array[][]): boolean;
}

declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;

/** Posición del bloque actual en el reloj del AudioContext. */
declare const currentFrame: number;
