declare class AudioWorkletProcessor {
  readonly port: { postMessage(data: Float32Array): void };
  process(inputs: Float32Array[][]): boolean;
}

declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;
