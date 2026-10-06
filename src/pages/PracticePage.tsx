import { useState } from "react";
import { Link } from "react-router-dom";
import { practiceCommand, type GamePhase } from "../game/GameLoop";
import { layoutChart } from "../game/ChartRenderer";
import { useSession } from "../store/session";

export function PracticePage() {
  const song = useSession((state) => state.song);
  const [phase, setPhase] = useState<GamePhase>("idle");

  function onKeyDown(key: string) {
    const command = practiceCommand(key, phase);
    if (command === "start") {
      setPhase("playing");
    }
    if (command === "finish") {
      setPhase("finished");
    }
  }

  if (!song) {
    return (
      <main className="page">
        <header className="page-head">
          <p className="eyebrow">Sala de ensayo</p>
          <h1>Práctica</h1>
        </header>
        <section className="empty-stage">
          <p>Elige una canción en la biblioteca.</p>
          <Link className="button" to="/biblioteca">
            Abrir biblioteca
          </Link>
        </section>
      </main>
    );
  }

  const boxes = layoutChart(
    song.chords.map((chord) => chord.chord),
    320,
  );

  return (
    <main className="page" tabIndex={0} onKeyDown={(event) => onKeyDown(event.key)}>
      <header className="page-head">
        <p className="eyebrow">Carta en curso</p>
        <h1>{song.title}</h1>
        <p className="lead">
          {song.artist} · {song.bpm} BPM
        </p>
      </header>
      <ol className="chart" aria-label="Carta">
        {boxes.map((box) => (
          <li key={`${box.x}-${box.symbol}`}>{box.symbol}</li>
        ))}
      </ol>
      <div className="actions">
        <button type="button" onClick={() => onKeyDown(" ")}>
          Empezar
        </button>
        <p className="status-pill" role="status">
          {phase === "playing" ? "En curso" : "En espera"}
        </p>
      </div>
      <p className="hint">Espacio empieza. Enter cierra el intento.</p>
    </main>
  );
}
