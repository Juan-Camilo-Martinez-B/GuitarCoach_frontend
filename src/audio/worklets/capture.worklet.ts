export function pushSamples(
  buffer: number[],
  input: ArrayLike<number>,
  chunkSize: number,
): Float32Array | null {
  for (let index = 0; index < input.length; index += 1) {
    buffer.push(input[index]);
  }
  if (buffer.length < chunkSize) {
    return null;
  }
  return Float32Array.from(buffer.splice(0, chunkSize));
}

export interface CapturedChunk {
  samples: Float32Array;
  /** Posición de la primera muestra en el reloj del AudioContext. */
  frame: number;
}

const processorReady = typeof AudioWorkletProcessor !== "undefined";

if (processorReady) {
  class CaptureProcessor extends AudioWorkletProcessor {
    process(inputs: Float32Array[][]): boolean {
      const channel = inputs[0]?.[0];
      if (channel) {
        // El búfer del navegador se reutiliza: hay que copiarlo antes de enviarlo.
        const message: CapturedChunk = { samples: channel.slice(), frame: currentFrame };
        this.port.postMessage(message);
      }
      return true;
    }
  }

  registerProcessor("capture", CaptureProcessor);
}
