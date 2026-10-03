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

const processorReady = typeof AudioWorkletProcessor !== "undefined";

if (processorReady) {
  class CaptureProcessor extends AudioWorkletProcessor {
    private readonly buffer: number[] = [];

    process(inputs: Float32Array[][]): boolean {
      const channel = inputs[0]?.[0];
      if (channel) {
        const chunk = pushSamples(this.buffer, channel, 128);
        if (chunk) {
          this.port.postMessage(chunk);
        }
      }
      return true;
    }
  }

  registerProcessor("capture", CaptureProcessor);
}
