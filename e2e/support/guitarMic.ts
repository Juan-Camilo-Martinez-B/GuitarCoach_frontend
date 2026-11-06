// Micrófono simulado para la página real: toca muestras de guitarra por un MediaStream, en el
// momento en que la práctica termina la cuenta de entrada. No simula la sala ni un micrófono.
import { RATE, render, shapeMidis, type Hit } from "./listeningBench";

// Los mismos golpes de la lección: un compás de cuatro tiempos con seis rasgueos.
const STRUM_BEATS = [0, 1, 1.5, 2.5, 3, 3.5];
const BEATS_PER_BAR = 4;
const COUNT_IN_BEATS = 4;
// Margen con el que la práctica programa el primer clic (START_MARGIN_SECONDS).
const START_MARGIN_SECONDS = 0.15;
// La cuenta se ve en la pantalla como mucho un ciclo del cursor después de empezar.
const VERDICT_LAG_SECONDS = 0.03;

export interface GuitarMicOptions {
  /** Acorde de cada compás; una lista vacía deja el micrófono en silencio. */
  bars: string[];
  bpm: number;
  noise?: number;
}

function strumHits(bars: string[], beat: number): Hit[] {
  return bars.flatMap((symbol, bar) =>
    STRUM_BEATS.map((offset, index) => {
      const next = STRUM_BEATS[index + 1] ?? BEATS_PER_BAR;
      return {
        midis: shapeMidis(symbol),
        at: (bar * BEATS_PER_BAR + offset) * beat,
        spread: 0.02,
        hold: (next - offset) * beat * 0.9,
      };
    }),
  );
}

export async function installGuitarMic({ bars, bpm, noise = 0.002 }: GuitarMicOptions) {
  const beat = 60 / bpm;
  const samples =
    bars.length > 0
      ? await render(strumHits(bars, beat), bars.length * BEATS_PER_BAR * beat + 1, noise)
      : null;
  const mic = window as unknown as { micStarted: number };
  mic.micStarted = 0;

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: async () => {
        const context = new AudioContext({ sampleRate: RATE });
        const output = context.createMediaStreamDestination();
        if (samples) {
          const buffer = context.createBuffer(1, samples.length, RATE);
          buffer.copyToChannel(new Float32Array(samples), 0);
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(output);
          const watcher = new MutationObserver(() => {
            if (document.querySelector(".verdict")?.textContent?.startsWith("Empieza en")) {
              watcher.disconnect();
              const delay = START_MARGIN_SECONDS + COUNT_IN_BEATS * beat - VERDICT_LAG_SECONDS;
              source.start(context.currentTime + delay);
              mic.micStarted += 1;
            }
          });
          watcher.observe(document.body, {
            subtree: true,
            childList: true,
            characterData: true,
          });
        }
        return output.stream;
      },
    },
  });
}
