import { useState } from "react";
import { layoutChart } from "../game/ChartRenderer";
import { practiceCommand, type GamePhase } from "../game/GameLoop";
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
      <main>
        <h1>Práctica</h1>
        <p>Elige una canción en la biblioteca.</p>
      </main>
    );
  }

  const boxes = layoutChart(
    song.chords.map((chord) => chord.chord),
    320,
  );

  return (
    <main tabIndex={0} onKeyDown={(event) => onKeyDown(event.key)}>
      <h1>{song.title}</h1>
      <p>
        {song.artist} · {song.bpm} BPM
      </p>
      <ol aria-label="Carta">
        {boxes.map((box) => (
          <li key={`${box.x}-${box.symbol}`}>{box.symbol}</li>
        ))}
      </ol>
      <button type="button" onClick={() => onKeyDown(" ")}>
        Empezar
      </button>
      <p role="status">{phase === "playing" ? "En curso" : "En espera"}</p>
    </main>
  );
}
