import { useEffect, useRef, useState } from "react";
import { AudioEngine, tunerStatusLabel, type EngineState } from "../audio/engine/AudioEngine";
import { needleX } from "../audio/tuner/channel";
import { noteFromFrequency } from "../audio/dsp/noteMath";

export function TunerPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<EngineState>("idle");
  const [note, setNote] = useState("—");

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
      context.beginPath();
      context.moveTo(needleX(0, canvas.width), 0);
      context.lineTo(needleX(0, canvas.width), canvas.height);
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
    <main>
      <h1>Afinador</h1>
      <canvas ref={canvasRef} width={320} height={80} aria-label="Aguja del afinador" />
      <p>{note}</p>
      <button type="button" onClick={() => void activate()}>
        Activar micrófono
      </button>
      <p role="status">{tunerStatusLabel(state)}</p>
    </main>
  );
}
