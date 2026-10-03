function reverseBits(value: number, width: number): number {
  let bits = 0;
  let current = value;
  for (let index = 0; index < width; index += 1) {
    bits = (bits << 1) | (current & 1);
    current >>= 1;
  }
  return bits;
}

export function fftMagnitudes(input: Float32Array): Float32Array {
  const size = input.length;
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error("La FFT pide una potencia de dos.");
  }
  const width = Math.log2(size);
  const real = new Float32Array(size);
  const imag = new Float32Array(size);
  for (let index = 0; index < size; index += 1) {
    real[reverseBits(index, width)] = input[index];
  }
  for (let block = 2; block <= size; block *= 2) {
    const half = block / 2;
    const angle = (-2 * Math.PI) / block;
    for (let start = 0; start < size; start += block) {
      for (let bin = 0; bin < half; bin += 1) {
        const wr = Math.cos(angle * bin);
        const wi = Math.sin(angle * bin);
        const even = start + bin;
        const odd = even + half;
        const tr = wr * real[odd] - wi * imag[odd];
        const ti = wr * imag[odd] + wi * real[odd];
        real[odd] = real[even] - tr;
        imag[odd] = imag[even] - ti;
        real[even] += tr;
        imag[even] += ti;
      }
    }
  }
  const magnitudes = new Float32Array(size / 2);
  for (let index = 0; index < magnitudes.length; index += 1) {
    magnitudes[index] = Math.hypot(real[index], imag[index]);
  }
  return magnitudes;
}
