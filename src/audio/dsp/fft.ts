/** Tablas de un tamaño de FFT: el análisis del micrófono corre decenas de veces por segundo. */
class FftPlan {
  readonly reversed: Uint32Array;
  readonly cosines: Float64Array;
  readonly sines: Float64Array;
  readonly real: Float64Array;
  readonly imag: Float64Array;

  constructor(readonly size: number) {
    const width = Math.log2(size);
    this.reversed = new Uint32Array(size);
    for (let index = 0; index < size; index += 1) {
      let bits = 0;
      let current = index;
      for (let bit = 0; bit < width; bit += 1) {
        bits = (bits << 1) | (current & 1);
        current >>= 1;
      }
      this.reversed[index] = bits;
    }
    this.cosines = new Float64Array(size / 2);
    this.sines = new Float64Array(size / 2);
    for (let index = 0; index < size / 2; index += 1) {
      const angle = (-2 * Math.PI * index) / size;
      this.cosines[index] = Math.cos(angle);
      this.sines[index] = Math.sin(angle);
    }
    this.real = new Float64Array(size);
    this.imag = new Float64Array(size);
  }
}

const PLANS = new Map<number, FftPlan>();

function planFor(size: number): FftPlan {
  let plan = PLANS.get(size);
  if (!plan) {
    plan = new FftPlan(size);
    PLANS.set(size, plan);
  }
  return plan;
}

export function fftMagnitudes(input: Float32Array): Float32Array {
  const size = input.length;
  if (size < 2 || (size & (size - 1)) !== 0) {
    throw new Error("La FFT pide una potencia de dos.");
  }
  const { reversed, cosines, sines, real, imag } = planFor(size);
  for (let index = 0; index < size; index += 1) {
    real[reversed[index]] = input[index];
    imag[index] = 0;
  }
  for (let block = 2; block <= size; block *= 2) {
    const half = block / 2;
    const step = size / block;
    for (let start = 0; start < size; start += block) {
      for (let bin = 0; bin < half; bin += 1) {
        const wr = cosines[bin * step];
        const wi = sines[bin * step];
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

const HANN = new Map<number, Float32Array>();

/** Multiplica por una ventana de Hann y calcula el espectro. */
export function hannSpectrum(samples: Float32Array): Float32Array {
  const size = samples.length;
  let window = HANN.get(size);
  if (!window) {
    window = new Float32Array(size);
    for (let index = 0; index < size; index += 1) {
      window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (size - 1));
    }
    HANN.set(size, window);
  }
  const windowed = new Float32Array(size);
  for (let index = 0; index < size; index += 1) {
    windowed[index] = samples[index] * window[index];
  }
  return fftMagnitudes(windowed);
}
