import { useEffect, useRef, useState } from "react";
import { AudioEngine, tunerStatusLabel, type EngineState } from "../audio/engine/AudioEngine";
import { playMidi, warmNotes } from "../audio/guitarTone";
import { needleX } from "../audio/tuner/channel";
import { startPitchMonitor } from "../audio/tuner/listen";
import {
  GUITAR_STRINGS,
  nearestString,
  readingMidi,
  tuningAdvice,
  type GuitarString,
} from "../audio/tuner/strings";
import { THEME_EVENT } from "../theme/theme";

function paintNeedle(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  cents: number,
  inTune: boolean,
) {
  const styles = getComputedStyle(document.documentElement);
  const tick = styles.getPropertyValue("--tick").trim();
  const needle = styles.getPropertyValue(inTune ? "--good" : "--brass").trim();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = tick;
  context.lineWidth = 1;
  for (let mark = 0; mark <= 10; mark += 1) {
    const x = (mark / 10) * canvas.width;
    const tall = mark === 5;
    context.beginPath();
    context.moveTo(x, tall ? 16 : 28);
    context.lineTo(x, tall ? canvas.height - 16 : 48);
    context.stroke();
  }
  const center = needleX(cents, canvas.width);
  context.strokeStyle = needle;
  context.lineWidth = 3;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(center, 10);
  context.lineTo(center, canvas.height - 10);
  context.stroke();
}

interface Target {
  string: GuitarString;
  cents: number;
}

export function TunerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const centsRef = useRef({ cents: 0, inTune: false });
  const stopRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<EngineState>("idle");
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    warmNotes(GUITAR_STRINGS.map((string) => string.midi));
    return () => {
      stopRef.current?.();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    let frame = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const paint = () => {
      paintNeedle(canvas, context, centsRef.current.cents, centsRef.current.inTune);
      if (!reduced) {
        frame = requestAnimationFrame(paint);
      }
    };
    const repaint = () => {
      cancelAnimationFrame(frame);
      paint();
    };
    paint();
    window.addEventListener(THEME_EVENT, repaint);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(THEME_EVENT, repaint);
    };
  }, []);

  function show(next: Target | null) {
    centsRef.current = next
      ? { cents: next.cents, inTune: tuningAdvice(next.cents).kind === "afinada" }
      : { cents: 0, inTune: false };
    setTarget(next);
  }

  async function activate() {
    stopRef.current?.();
    stopRef.current = null;
    show(null);
    const engine = new AudioEngine({
      request: async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!(stream instanceof MediaStream)) {
          return;
        }
        stopRef.current = await startPitchMonitor(stream, (reading) => {
          show(reading ? nearestString(readingMidi(reading)) : null);
        });
      },
    });
    await engine.start();
    setState(engine.state);
  }

  function deactivate() {
    stopRef.current?.();
    stopRef.current = null;
    show(null);
    setState("idle");
  }

  const advice = target ? tuningAdvice(target.cents) : null;
  const listening = state === "listening";

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Cuerda a cuerda</p>
        <h1>Afinador</h1>
        <p className="lead">
          Toca una cuerda al aire. La aguja muestra cuánto le falta para su nota.
        </p>
      </header>
      <section
        className={advice ? `meter is-${advice.kind}` : "meter"}
        aria-label="Tablero del afinador"
      >
        <canvas ref={canvasRef} width={640} height={120} aria-hidden="true" />
        <p className={target ? "note-readout" : "note-readout is-idle"}>
          {target ? `Cuerda ${target.string.number}` : "A la espera"}
        </p>
        <p className="cents-readout" role="status">
          {target && advice
            ? `${target.string.name} · ${target.cents > 0 ? "+" : ""}${target.cents} cents · ${advice.text}`
            : listening
              ? "Toca una cuerda"
              : "Activa el micrófono para empezar"}
        </p>
      </section>
      <div className="actions">
        {listening ? (
          <button type="button" onClick={deactivate}>
            Apagar micrófono
          </button>
        ) : (
          <button type="button" onClick={() => void activate()}>
            Activar micrófono
          </button>
        )}
        <p className="status-pill">{tunerStatusLabel(state)}</p>
      </div>
      <section className="panel">
        <h2>Tono de referencia</h2>
        <p className="hint">Pulsa una cuerda para oír cómo debe sonar y compárala de oído.</p>
        <div className="reference-strings" role="group" aria-label="Cuerdas al aire">
          {GUITAR_STRINGS.map((string) => (
            <button
              key={string.number}
              type="button"
              className="button-ghost"
              aria-pressed={target?.string.number === string.number}
              onClick={() => playMidi(string.midi)}
            >
              <strong>{string.number}</strong> {string.name}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
