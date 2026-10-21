import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import {
  playChord,
  playMidi,
  playPattern,
  playSlots,
  playStrum,
  stopGuitar,
  warmNotes,
} from "../audio/guitarTone";
import { startPitchMonitor } from "../audio/tuner/listen";
import { placeNote, shapeFor } from "../chords/shapes";
import { STRUM_PATTERN } from "../domain/course";
import type { Song, SongStudy, StudyStep } from "../domain/types";
import { layoutChart } from "../game/ChartRenderer";
import { practiceCommand, type GamePhase } from "../game/GameLoop";
import { detectedChord } from "../game/heardChord";
import { useSession, type TeachingMode } from "../store/session";
import { ChordFigure } from "../ui/ChordDiagram";
import { StrumRail } from "../ui/StrumRail";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function chordAt(bar: number, beat: number, bpm: number): number {
  return ((bar - 1) * 4 + (beat - 1)) * (60000 / bpm);
}

function beatsOf(steps: StudyStep[], index: number): number {
  const start = (steps[index].bar - 1) * 4 + (steps[index].beat - 1);
  const next = steps[index + 1];
  if (next) {
    return Math.max(0.5, (next.bar - 1) * 4 + (next.beat - 1) - start);
  }
  return 4 - ((steps[index].beat - 1) % 4);
}

export function PracticePage() {
  const song = useSession((state) => state.song);
  const study = useSession((state) => state.study);
  const teachingMode = useSession((state) => state.teachingMode);
  const token = useSession((state) => state.token);
  const setLastAttemptId = useSession((state) => state.setLastAttemptId);
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState(0);
  const [arrow, setArrow] = useState(-1);
  const [message, setMessage] = useState("El micrófono mide el ataque de cada acorde.");
  const stopRef = useRef<(() => Promise<void>) | null>(null);
  const heardRef = useRef<string | null>(null);
  const hitsRef = useRef<Map<number, { detected: string | null; deltaMs: number }>>(new Map());
  const startedRef = useRef(0);
  const savingRef = useRef(false);
  const listenRef = useRef<number[]>([]);
  const listenTicket = useRef(0);

  useEffect(() => {
    return () => {
      listenRef.current.forEach((id) => window.clearTimeout(id));
      void stopRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (!song || teachingMode !== "notas") {
      return;
    }
    warmNotes(
      practiceSteps(song, study, teachingMode).flatMap((step) => {
        const note = placeNote(step.symbol);
        return note ? [note.midi] : [];
      }),
    );
  }, [song, study, teachingMode]);

  async function finish() {
    if (savingRef.current) {
      return;
    }
    savingRef.current = true;
    await stopRef.current?.();
    stopRef.current = null;
    if (!song) {
      setPhase("finished");
      return;
    }
    if (!token) {
      setPhase("finished");
      setMessage("Práctica terminada. No se guardó.");
      return;
    }
    const steps = practiceSteps(song, study, teachingMode);
    const events = steps.map((step, index) => {
      const hit = hitsRef.current.get(index);
      return {
        bar: step.bar,
        expected: step.symbol,
        detected: hit?.detected ?? null,
        deltaMs: hit?.deltaMs ?? 1000,
        confidence: hit ? 0.8 : 0,
      };
    });
    try {
      const saved = await new ApiClient(apiUrl, fetch, token).createAttempt(
        song.id,
        song.bpm,
        events,
      );
      setLastAttemptId(saved.id);
      setMessage(`Intento guardado. Precisión ${Math.round(saved.accuracy)}%.`);
      setPhase("finished");
    } catch (error) {
      savingRef.current = false;
      setPhase("finished");
      setMessage(error instanceof ApiError ? error.message : "No se pudo guardar el intento.");
    }
  }

  async function begin() {
    if (!song) {
      return;
    }
    savingRef.current = false;
    if (!token) {
      setMessage("En curso. Esta práctica no se guardará.");
    }
    hitsRef.current = new Map();
    heardRef.current = null;
    setActive(0);
    setPhase("playing");
    const media = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (!media) {
      setMessage("Este navegador no abrió el micrófono.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await media({ audio: true });
    } catch {
      setMessage("Permiso de micrófono denegado.");
      setPhase("idle");
      return;
    }
    if (!(stream instanceof MediaStream)) {
      setMessage("En curso, sin análisis de audio.");
      return;
    }
    startedRef.current = performance.now();
    stopRef.current = await startPitchMonitor(stream, (reading) => {
      const note = reading?.name ?? null;
      heardRef.current = note;
      const elapsed = performance.now() - startedRef.current;
      const steps = practiceSteps(song, study, teachingMode);
      steps.forEach((step, index) => {
        const at = chordAt(step.bar, step.beat, song.bpm);
        if (Math.abs(elapsed - at) < 180) {
          setActive(index);
        }
        if (hitsRef.current.has(index) || note === null) {
          return;
        }
        if (elapsed >= at - 80 && elapsed <= at + 700) {
          hitsRef.current.set(index, {
            detected: detectedChord(note, step.symbol),
            deltaMs: Math.round(elapsed - at),
          });
        }
      });
    });
    const last = practiceSteps(song, study, teachingMode).reduce(
      (max, step) => Math.max(max, chordAt(step.bar, step.beat, song.bpm)),
      0,
    );
    window.setTimeout(() => {
      if (useSession.getState().song?.id === song.id) {
        void finish();
      }
    }, last + 900);
  }

  function onKeyDown(key: string) {
    const command = practiceCommand(key, phase);
    if (command === "start") {
      void begin();
    }
    if (command === "finish") {
      void finish();
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

  const steps = practiceSteps(song, study, teachingMode);
  const boxes = layoutChart(
    steps.map((step) => step.label),
    320,
  );
  const shown = phase === "playing" && active >= 0 ? active : picked;
  const step = steps[shown] ?? steps[0];
  const placed = step ? placeNote(step.symbol) : null;

  function hearChart() {
    listenTicket.current += 1;
    const ticket = listenTicket.current;
    listenRef.current.forEach((id) => window.clearTimeout(id));
    listenRef.current = [];
    const lengths = steps.map((_, position) => beatsOf(steps, position));
    if (teachingMode === "notas") {
      stopGuitar();
      let beat = 0;
      steps.forEach((item, position) => {
        const at = beat * (60 / song.bpm);
        listenRef.current.push(
          window.setTimeout(() => {
            setPicked(position);
            const note = placeNote(item.symbol);
            if (note) {
              playMidi(note.midi);
            }
          }, at * 1000),
        );
        beat += lengths[position] ?? 4;
      });
      return;
    }
    void Promise.all(steps.map((item) => shapeFor(item.symbol))).then((found) => {
      if (ticket !== listenTicket.current) {
        return;
      }
      const hits = playSlots(found, lengths, song.bpm);
      for (const hit of hits) {
        listenRef.current.push(
          window.setTimeout(() => {
            setPicked(hit.slot);
            setArrow(hit.hit);
          }, hit.at * 1000),
        );
      }
    });
  }

  return (
    <main className="page" tabIndex={0} onKeyDown={(event) => onKeyDown(event.key)}>
      <header className="page-head">
        <p className="eyebrow">Carta en curso</p>
        <h1>{song.title}</h1>
        <p className="lead">
          {song.artist} · {song.bpm} BPM · {teachingMode === "notas" ? "notas" : "acordes"}
        </p>
      </header>
      <ol className="chart" aria-label="Carta">
        {boxes.map((box, index) => (
          <li key={`${box.x}-${box.symbol}`} className={index === shown ? "is-now" : undefined}>
            <button type="button" className="chart-hit" onClick={() => setPicked(index)}>
              {box.symbol}
              <small>
                {teachingMode === "notas"
                  ? `cuerda ${placeNote(steps[index]?.symbol ?? "")?.string ?? ""}`
                  : STRUM_PATTERN[index % STRUM_PATTERN.length] === "abajo"
                    ? "↓"
                    : "↑"}
              </small>
            </button>
          </li>
        ))}
      </ol>
      {step ? (
        <section className="panel song-lesson">
          {teachingMode === "acordes" ? (
            <>
              <ChordFigure symbol={step.symbol} />
              <StrumRail
                active={arrow}
                onStrum={(direction, index) => {
                  setArrow(index);
                  void shapeFor(step.symbol).then((found) => {
                    if (found) {
                      playStrum(found, direction);
                    }
                  });
                }}
              />
            </>
          ) : placed ? (
            <button type="button" className="note-key" onClick={() => playMidi(placed.midi)}>
              <strong>{placed.string}</strong>
              <span>
                Cuerda {placed.string}
                {placed.fret === 0 ? ", al aire" : `, traste ${placed.fret}`}
              </span>
            </button>
          ) : null}
          <div className="actions">
            <button
              type="button"
              className="button-ghost"
              onClick={() => setPicked(Math.max(0, shown - 1))}
            >
              Anterior
            </button>
            <button
              type="button"
              className="button-ghost"
              onClick={() => setPicked(Math.min(steps.length - 1, shown + 1))}
            >
              Siguiente
            </button>
            {teachingMode === "acordes" ? (
              <button
                type="button"
                onClick={() => {
                  void shapeFor(step.symbol).then((found) => {
                    if (found) {
                      playChord(found);
                    }
                  });
                }}
              >
                Escuchar el acorde
              </button>
            ) : null}
            <button type="button" onClick={hearChart}>
              Escuchar la canción
            </button>
            <button
              type="button"
              onClick={() => {
                if (teachingMode === "notas" && placed) {
                  playMidi(placed.midi);
                  return;
                }
                void shapeFor(step.symbol).then((found) => {
                  if (found) {
                    playPattern(found, song.bpm);
                  }
                });
              }}
            >
              {teachingMode === "notas" ? "Escuchar la nota" : "Escuchar el rasgueo"}
            </button>
          </div>
        </section>
      ) : null}
      {token ? null : (
        <p className="note">
          Puedes practicar sin entrar. Esta práctica no se guardará.{" "}
          <Link to="/entrar">Inicia sesión</Link> para conservarla.
        </p>
      )}
      <div className="actions">
        <button type="button" onClick={() => onKeyDown(" ")}>
          Empezar
        </button>
        <button className="button-ghost" type="button" onClick={() => void finish()}>
          Cerrar intento
        </button>
        <p className="status-pill" role="status">
          {phase === "playing" ? "En curso" : phase === "finished" ? message : "En espera"}
        </p>
      </div>
      {study ? <p className="hint">{study.summary}</p> : null}
      <p className="hint">
        {message} Espacio empieza. Enter cierra el intento.{" "}
        <Link to="/informe">Ver el informe</Link>
      </p>
    </main>
  );
}

function practiceSteps(song: Song, study: SongStudy | null, mode: TeachingMode): StudyStep[] {
  if (mode === "notas" && study && study.melody.length > 0) {
    return study.melody;
  }
  if (study && study.chords.length > 0) {
    return study.chords;
  }
  return song.chords.map((chord) => ({
    bar: chord.bar,
    beat: chord.beat,
    symbol: chord.chord,
    label: chord.chord,
    detail: "",
  }));
}
