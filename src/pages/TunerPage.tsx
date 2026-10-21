import { useEffect, useRef, useState } from "react";
import { AudioEngine, tunerStatusLabel, type EngineState } from "../audio/engine/AudioEngine";
import { needleX } from "../audio/tuner/channel";
import { startPitchMonitor } from "../audio/tuner/listen";
import { THEME_EVENT } from "../theme/theme";

function paintNeedle(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, cents: number) {
  const styles = getComputedStyle(document.documentElement);
  const tick = styles.getPropertyValue("--tick").trim();
  const brass = styles.getPropertyValue("--brass").trim();
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
  context.strokeStyle = brass;
  context.lineWidth = 3;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(center, 10);
  context.lineTo(center, canvas.height - 10);
  context.stroke();
}

function centsLabel(cents: number): string {
  if (cents > 0) {
    return `+${cents} cents`;
  }
  return `${cents} cents`;
}

export function TunerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const centsRef = useRef(0);
  const stopRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<EngineState>("idle");
  const [note, setNote] = useState("");
  const [cents, setCents] = useState(0);

  useEffect(() => {
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
      paintNeedle(canvas, context, centsRef.current);
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

  async function activate() {
    stopRef.current?.();
    stopRef.current = null;
    centsRef.current = 0;
    setCents(0);
    setNote("");
    const engine = new AudioEngine({
      request: async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!(stream instanceof MediaStream)) {
          return;
        }
        stopRef.current = await startPitchMonitor(stream, (reading) => {
          if (!reading) {
            centsRef.current = 0;
            setCents(0);
            setNote("");
            return;
          }
          centsRef.current = reading.cents;
          setCents(reading.cents);
          setNote(`${reading.name}${reading.octave}`);
        });
      },
    });
    await engine.start();
    setState(engine.state);
  }

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Cuerda a cuerda</p>
        <h1>Afinador</h1>
        <p className="lead">Centra la aguja antes de entrar a la carta.</p>
      </header>
      <section className="meter" aria-label="Tablero del afinador">
        <canvas ref={canvasRef} width={640} height={120} aria-label="Aguja del afinador" />
        <p className={note ? "note-readout" : "note-readout is-idle"}>{note || "A la espera"}</p>
        <p className="cents-readout">{note ? centsLabel(cents) : "Toca una cuerda"}</p>
      </section>
      <div className="actions">
        <button type="button" onClick={() => void activate()}>
          Activar micrófono
        </button>
        <p className="status-pill" role="status">
          {tunerStatusLabel(state)}
        </p>
      </div>
    </main>
  );
}
