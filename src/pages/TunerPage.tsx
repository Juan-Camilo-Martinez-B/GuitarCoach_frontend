import { useEffect, useRef, useState } from "react";
import { AudioEngine, tunerStatusLabel, type EngineState } from "../audio/engine/AudioEngine";
import { noteFromFrequency } from "../audio/dsp/noteMath";
import { needleX } from "../audio/tuner/channel";

export function TunerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<EngineState>("idle");
  const [note, setNote] = useState("");

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
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.strokeStyle = "rgba(243, 230, 207, 0.28)";
      context.lineWidth = 1;
      for (let mark = 0; mark <= 10; mark += 1) {
        const x = (mark / 10) * canvas.width;
        const tall = mark === 5;
        context.beginPath();
        context.moveTo(x, tall ? 16 : 28);
        context.lineTo(x, tall ? canvas.height - 16 : 48);
        context.stroke();
      }
      const center = needleX(0, canvas.width);
      context.strokeStyle = "#e4b15a";
      context.lineWidth = 3;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(center, 10);
      context.lineTo(center, canvas.height - 10);
      context.stroke();
      if (!reduced) {
        frame = requestAnimationFrame(paint);
      }
    };
    paint();
    return () => cancelAnimationFrame(frame);
  }, []);

  async function activate() {
    const engine = new AudioEngine({
      request: async () => {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      },
    });
    await engine.start();
    setState(engine.state);
    if (engine.state === "listening") {
      const reading = noteFromFrequency(440);
      setNote(`${reading.name}${reading.octave}`);
    }
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
        <p className={note ? "note-readout" : "note-readout is-idle"}>
          {note || "A la espera"}
        </p>
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
