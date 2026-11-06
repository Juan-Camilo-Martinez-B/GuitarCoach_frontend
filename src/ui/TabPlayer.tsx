import { useEffect, useRef, useState } from "react";
import { stopGuitar } from "../audio/guitarTone";
import { formatClock } from "../tab/tabFile";
import { useAlphaTab } from "../tab/useAlphaTab";

const SPEEDS = [0.5, 0.6, 0.75, 0.9, 1];

/**
 * La tablatura de la canción, dibujada y tocada con las notas del archivo: ligados, bends
 * y slides incluidos, con el cursor siguiendo cada nota.
 */
export function TabPlayer({ data }: { data: ArrayBuffer }) {
  const host = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const tab = useAlphaTab(host, viewport);
  const { state, load } = tab;
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [metronome, setMetronome] = useState(false);
  const [countIn, setCountIn] = useState(false);

  // Dos motores a la vez se pisan: la guitarra de las guías se calla al abrir la tablatura.
  useEffect(() => {
    stopGuitar();
    load(data);
  }, [data, load]);

  const loaded = state.tracks.length > 0;

  return (
    <>
      <section className="panel tab-controls">
        <p className="hint">Suena solo la guitarra del archivo, nota por nota.</p>
        {state.error ? (
          <p className="tab-error" role="alert">
            {state.error}
          </p>
        ) : null}

        {loaded ? null : <p className="hint">Cargando la tablatura...</p>}
        {loaded ? (
          <>
            <div className="tab-row">
              {state.tracks.length > 1 ? (
                <label>
                  Guitarra
                  <select
                    value={state.track}
                    onChange={(event) => tab.selectTrack(Number(event.target.value))}
                  >
                    {state.tracks.map((track) => (
                      <option key={track.index} value={track.index}>
                        {track.name || `Pista ${track.index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label>
                Velocidad: {Math.round(speed * 100)} %
                <select
                  value={speed}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setSpeed(next);
                    tab.setSpeed(next);
                  }}
                >
                  {SPEEDS.map((value) => (
                    <option key={value} value={value}>
                      {Math.round(value * 100)} %
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="player-toggles">
              <label className="check">
                <input
                  type="checkbox"
                  checked={countIn}
                  onChange={(event) => {
                    setCountIn(event.target.checked);
                    tab.setCountIn(event.target.checked);
                  }}
                />
                Cuenta de entrada
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={metronome}
                  onChange={(event) => {
                    setMetronome(event.target.checked);
                    tab.setMetronome(event.target.checked);
                  }}
                />
                Metrónomo
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={(event) => {
                    setLoop(event.target.checked);
                    tab.setLooping(event.target.checked);
                  }}
                />
                Repetir
              </label>
            </div>
            <div className="actions">
              <button type="button" onClick={tab.playPause} disabled={!state.ready}>
                {state.playing
                  ? "Pausa"
                  : state.ready
                    ? "Escuchar la guitarra"
                    : "Cargando sonido..."}
              </button>
              <button type="button" className="button-ghost" onClick={tab.stop}>
                Detener
              </button>
              <span className="tab-clock" aria-live="off">
                {formatClock(state.current)} / {formatClock(state.total)}
              </span>
            </div>
            <p className="hint">
              Haz clic en una nota para empezar desde ahí. Arrastra sobre la partitura para repetir
              solo ese tramo.
            </p>
          </>
        ) : null}
      </section>

      {/* Sin display: none: alphaTab mide el ancho del contenedor para dibujar. */}
      <div ref={viewport} className={loaded ? "tab-viewport" : "tab-viewport is-empty"}>
        <div ref={host} />
      </div>
    </>
  );
}
