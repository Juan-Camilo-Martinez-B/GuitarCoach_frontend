import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import { playChord, playPattern, playSlots, playStrum, stopGuitar } from "../audio/guitarTone";
import { startPitchMonitor } from "../audio/tuner/listen";
import { shapeFor, spanishName } from "../chords/shapes";
import { patternForTitle } from "../domain/course";
import type { Song, SongStudy, StudyStep } from "../domain/types";
import { layoutChart } from "../game/ChartRenderer";
import { chordVerdictText } from "../game/chordVerdict";
import { practiceCommand, type GamePhase } from "../game/GameLoop";
import { detectedChord } from "../game/heardChord";
import { useSession } from "../store/session";
import { ChordFigure } from "../ui/ChordDiagram";
import { queueStrumMarks } from "../ui/strumMarks";
import { STRUM_GLYPH, StrumRail } from "../ui/StrumRail";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type Drill = "acorde" | "rasgueo" | "progresion";
type Mark = "bien" | "no";
type StopListening = () => void | Promise<void>;

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
  const token = useSession((state) => state.token);
  const setLastAttemptId = useSession((state) => state.setLastAttemptId);
  const [drill, setDrill] = useState<Drill>("acorde");
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState(0);
  const [arrow, setArrow] = useState(-1);
  const [marks, setMarks] = useState<Record<number, Mark>>({});
  const [verdict, setVerdict] = useState("Escuchando. Toca el acorde.");
  const [verdictKind, setVerdictKind] = useState<"espera" | Mark>("espera");
  const stopRef = useRef<StopListening | null>(null);
  const heardRef = useRef<string | null>(null);
  const hitsRef = useRef<Map<number, { detected: string | null; deltaMs: number }>>(new Map());
  const startedRef = useRef(0);
  const savingRef = useRef(false);
  const listenRef = useRef<number[]>([]);
  const listenTicket = useRef(0);
  const symbolRef = useRef("");
  const drillRef = useRef<Drill>("acorde");
  const endTimer = useRef(0);
  const stableRef = useRef({ note: "", count: 0 });
  drillRef.current = drill;

  const steps = song ? practiceSteps(song, study) : [];
  const practicePattern = useSession((state) => state.practicePattern);
  const pattern = practicePattern ?? patternForTitle(song?.title ?? "");
  symbolRef.current = steps[picked]?.symbol ?? steps[0]?.symbol ?? "";

  useEffect(() => {
    return () => {
      listenRef.current.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(endTimer.current);
      void stopRef.current?.();
      stopGuitar();
    };
  }, []);

  useEffect(() => {
    if (!song || drill === "progresion") {
      return;
    }
    let closed = false;
    let localStop: StopListening | null = null;
    const withStrum = drill === "rasgueo";
    stableRef.current = { note: "", count: 0 };

    async function listen() {
      const media = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
      if (!media) {
        setVerdict("Este navegador no abrió el micrófono.");
        setVerdictKind("no");
        return;
      }
      let stream: MediaStream;
      try {
        stream = await media({ audio: true });
      } catch {
        if (!closed) {
          setVerdict("Permiso de micrófono denegado.");
          setVerdictKind("no");
        }
        return;
      }
      if (closed || !(stream instanceof MediaStream)) {
        stream.getTracks?.().forEach((track) => track.stop());
        return;
      }
      localStop = await startPitchMonitor(stream, (reading) => {
        const note = reading?.name ?? null;
        const expected = symbolRef.current;
        if (!expected) {
          return;
        }
        if (!note) {
          stableRef.current = { note: "", count: 0 };
          return;
        }
        if (stableRef.current.note === note) {
          stableRef.current.count += 1;
        } else {
          stableRef.current = { note, count: 1 };
        }
        if (stableRef.current.count < 4) {
          return;
        }
        const text = chordVerdictText(note, expected);
        const ok = text.startsWith("Bien");
        setVerdict(withStrum && ok ? `Bien. ${spanishName(expected)} con el rasgueo.` : text);
        setVerdictKind(ok ? "bien" : "no");
      });
      stopRef.current = localStop;
      if (closed) {
        await localStop();
      }
    }

    void listen();
    return () => {
      closed = true;
      void localStop?.();
      if (stopRef.current === localStop) {
        stopRef.current = null;
      }
    };
  }, [drill, song]);

  async function finish() {
    if (savingRef.current || !song || drillRef.current !== "progresion") {
      return;
    }
    savingRef.current = true;
    await stopRef.current?.();
    stopRef.current = null;
    if (!token) {
      setPhase("finished");
      setVerdict("Práctica terminada. No se guardó.");
      setVerdictKind("espera");
      return;
    }
    const chart = practiceSteps(song, study);
    const events = chart.map((step, index) => {
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
      setVerdict(`Intento guardado. Precisión ${Math.round(saved.accuracy)}%.`);
      setVerdictKind("espera");
      setPhase("finished");
    } catch (error) {
      savingRef.current = false;
      setPhase("finished");
      setVerdict(error instanceof ApiError ? error.message : "No se pudo guardar el intento.");
      setVerdictKind("no");
    }
  }

  async function begin() {
    if (!song || drillRef.current !== "progresion") {
      return;
    }
    await stopRef.current?.();
    stopRef.current = null;
    savingRef.current = false;
    hitsRef.current = new Map();
    heardRef.current = null;
    setMarks({});
    setActive(0);
    setPhase("playing");
    setVerdict(token ? "En curso. Toca cada acorde." : "En curso. Esta práctica no se guardará.");
    setVerdictKind("espera");
    const media = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (!media) {
      setVerdict("Este navegador no abrió el micrófono.");
      setVerdictKind("no");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await media({ audio: true });
    } catch {
      setVerdict("Permiso de micrófono denegado.");
      setVerdictKind("no");
      setPhase("idle");
      return;
    }
    if (!(stream instanceof MediaStream)) {
      setVerdict("En curso, sin análisis de audio.");
      return;
    }
    startedRef.current = performance.now();
    const chart = practiceSteps(song, study);
    stopRef.current = await startPitchMonitor(stream, (reading) => {
      const note = reading?.name ?? null;
      heardRef.current = note;
      const elapsed = performance.now() - startedRef.current;
      chart.forEach((step, index) => {
        const at = chordAt(step.bar, step.beat, song.bpm);
        if (Math.abs(elapsed - at) < 180) {
          setActive(index);
          setPicked(index);
        }
        if (hitsRef.current.has(index) || note === null) {
          return;
        }
        if (elapsed >= at - 80 && elapsed <= at + 700) {
          const detected = detectedChord(note, step.symbol);
          const ok = detected === step.symbol;
          hitsRef.current.set(index, {
            detected,
            deltaMs: Math.round(elapsed - at),
          });
          setMarks((current) => ({ ...current, [index]: ok ? "bien" : "no" }));
          setVerdict(chordVerdictText(note, step.symbol));
          setVerdictKind(ok ? "bien" : "no");
        }
      });
    });
    const last = chart.reduce(
      (max, step) => Math.max(max, chordAt(step.bar, step.beat, song.bpm)),
      0,
    );
    window.clearTimeout(endTimer.current);
    endTimer.current = window.setTimeout(() => {
      if (drillRef.current === "progresion" && useSession.getState().song?.id === song.id) {
        void finish();
      }
    }, last + 900);
  }

  function onKeyDown(key: string) {
    if (drill !== "progresion") {
      return;
    }
    const command = practiceCommand(key, phase);
    if (command === "start") {
      void begin();
    }
    if (command === "finish") {
      void finish();
    }
  }

  function choose(next: Drill) {
    window.clearTimeout(endTimer.current);
    void stopRef.current?.();
    stopRef.current = null;
    setDrill(next);
    setPhase("idle");
    setActive(-1);
    setMarks({});
    savingRef.current = false;
    const symbol = steps[picked]?.symbol ?? steps[0]?.symbol;
    setVerdict(
      next === "progresion"
        ? "Pulsa Empezar y toca la progresión."
        : symbol
          ? `Escuchando. Toca ${spanishName(symbol)}.`
          : "Escuchando. Toca el acorde.",
    );
    setVerdictKind("espera");
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
    steps.map((step) => step.label),
    320,
  );
  const shown = phase === "playing" && active >= 0 ? active : picked;
  const step = steps[shown] ?? steps[0];
  // Las funciones declaradas no heredan el descarte de song nulo de más arriba.
  const bpm = song.bpm;

  function hearChart() {
    listenTicket.current += 1;
    const ticket = listenTicket.current;
    listenRef.current.forEach((id) => window.clearTimeout(id));
    listenRef.current = [];
    const lengths = steps.map((_, position) => beatsOf(steps, position));
    void Promise.all(steps.map((item) => shapeFor(item.symbol)))
      .then((found) =>
        ticket === listenTicket.current ? playSlots(found, lengths, bpm, pattern) : [],
      )
      .then((hits) => {
        if (ticket !== listenTicket.current || hits.length === 0) {
          return;
        }
        listenRef.current = queueStrumMarks(
          hits,
          (hit) => {
            setPicked(hit.slot);
            setArrow(hit.hit);
          },
          () => setArrow(-1),
        );
      });
  }

  return (
    <main className="page" tabIndex={0} onKeyDown={(event) => onKeyDown(event.key)}>
      <header className="page-head">
        <p className="eyebrow">Carta en curso</p>
        <h1>{song.title}</h1>
        <p className="lead">
          {song.artist} · {song.bpm} BPM
        </p>
      </header>
      <div className="auth-switch" role="tablist" aria-label="Modalidad de práctica">
        <button type="button" aria-pressed={drill === "acorde"} onClick={() => choose("acorde")}>
          Acorde solo
        </button>
        <button type="button" aria-pressed={drill === "rasgueo"} onClick={() => choose("rasgueo")}>
          Acorde y rasgueo
        </button>
        <button
          type="button"
          aria-pressed={drill === "progresion"}
          onClick={() => choose("progresion")}
        >
          Progresión
        </button>
      </div>
      <p className={`verdict is-${verdictKind}`} role="status">
        {verdict}
      </p>
      <p className="hint">El micrófono compara la nota más fuerte con la fundamental del acorde.</p>
      <ol className="chart" aria-label="Carta">
        {boxes.map((box, index) => (
          <li key={`${box.x}-${box.symbol}`} className={index === shown ? "is-now" : undefined}>
            <button type="button" className="chart-hit" onClick={() => setPicked(index)}>
              {box.symbol}
              <small>
                {marks[index] === "bien"
                  ? "Bien"
                  : marks[index] === "no"
                    ? "No"
                    : STRUM_GLYPH[pattern.directions[index % pattern.directions.length]]}
              </small>
            </button>
          </li>
        ))}
      </ol>
      {step ? (
        <section className="panel song-lesson">
          <ChordFigure symbol={step.symbol} />
          {drill !== "acorde" ? (
            <StrumRail
              pattern={pattern}
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
          ) : null}
          {drill === "rasgueo" ? <p className="hint">{pattern.hint}</p> : null}
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
            {drill !== "acorde" ? (
              <button
                type="button"
                onClick={() => {
                  listenTicket.current += 1;
                  const ticket = listenTicket.current;
                  listenRef.current.forEach((id) => window.clearTimeout(id));
                  listenRef.current = [];
                  void shapeFor(step.symbol)
                    .then((found) =>
                      found && ticket === listenTicket.current
                        ? playPattern(found, song.bpm, pattern)
                        : [],
                    )
                    .then((hits) => {
                      if (ticket !== listenTicket.current || hits.length === 0) {
                        return;
                      }
                      listenRef.current = queueStrumMarks(
                        hits,
                        (hit) => setArrow(hit.hit),
                        () => setArrow(-1),
                      );
                    });
                }}
              >
                Escuchar el rasgueo
              </button>
            ) : null}
            {drill === "progresion" ? (
              <button type="button" onClick={hearChart}>
                Escuchar la canción
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
      {token ? null : (
        <p className="note">
          Puedes practicar sin entrar. Esta práctica no se guardará.{" "}
          <Link to="/entrar">Inicia sesión</Link> para conservarla.
        </p>
      )}
      {drill === "progresion" ? (
        <div className="actions">
          <button type="button" onClick={() => onKeyDown(" ")}>
            Empezar
          </button>
          <button className="button-ghost" type="button" onClick={() => void finish()}>
            Cerrar intento
          </button>
        </div>
      ) : null}
      {study ? <p className="hint">{study.summary}</p> : null}
      {drill === "progresion" ? (
        <p className="hint">
          Espacio empieza. Enter cierra el intento. <Link to="/informe">Ver el informe</Link>
        </p>
      ) : null}
    </main>
  );
}

function practiceSteps(song: Song, study: SongStudy | null): StudyStep[] {
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
