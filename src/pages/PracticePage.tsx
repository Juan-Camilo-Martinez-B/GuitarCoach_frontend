import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import { chordCandidates } from "../audio/dsp/chordRecognizer";
import { playChord, playPattern, playSlots, playStrum, stopGuitar } from "../audio/guitarTone";
import type { ListenerEvent } from "../audio/listening/guitarListener";
import {
  ChordEvidence,
  ChordScoreFollower,
  MelodyFollower,
  noteLabel,
  type ChordSlot,
  type NoteMark,
} from "../audio/listening/scoreFollower";
import {
  GUITAR_MIC,
  startGuitarListener,
  stopTracks,
  type ListeningSession,
} from "../audio/tuner/listen";
import { shapeFor, spanishName } from "../chords/shapes";
import { melodyForTitle, patternForTitle } from "../domain/course";
import type { Song, SongStudy, StudyStep } from "../domain/types";
import { layoutChart } from "../game/ChartRenderer";
import { judgementVerdict } from "../game/chordVerdict";
import { practiceCommand, type GamePhase } from "../game/GameLoop";
import { useJourney } from "../store/journey";
import { useSession } from "../store/session";
import { useOnSignOut } from "../store/useOnSignOut";
import { ChordFigure } from "../ui/ChordDiagram";
import { Icon } from "../ui/Icon";
import { EmptyState, PageHeader } from "../ui/PageHeader";
import { queueStrumMarks } from "../ui/strumMarks";
import { StrumRail } from "../ui/StrumRail";
import { GlossaryText, Term } from "../ui/Term";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type Drill = "acorde" | "rasgueo" | "progresion" | "melodia";
type Mark = "bien" | "no";
type VerdictKind = "espera" | Mark;

const DRILLS: Array<{ id: Drill; title: string; text: string }> = [
  {
    id: "acorde",
    title: "Acorde solo",
    text: "Arma un acorde. El micrófono te dice si suena bien.",
  },
  {
    id: "rasgueo",
    title: "Acorde y rasgueo",
    text: "Suma el movimiento de la mano con las flechas.",
  },
  {
    id: "progresion",
    title: "Progresión",
    text: "Toca los acordes a tiempo y guarda tu resultado.",
  },
  { id: "melodia", title: "Notas y melodía", text: "Toca nota por nota. La app te dice cuál oye." },
];

const SPEEDS = [1, 0.75, 0.5];
const MIN_BPM = 20;
const MAX_BPM = 300;
const START_MARGIN_SECONDS = 0.15;
const CURSOR_TICK_MS = 30;
// Se espera a las ventanas largas antes de cerrar un tramo.
const SLOT_GRACE_SECONDS = 0.25;
const FINISH_GRACE_SECONDS = 0.5;
const MISSED_DELTA_MS = 1000;
const MAX_LATENCY_MS = 500;
const RECENT_NOTES = 8;
const MELODY_VIEW = 16;

function beatPosition(step: StudyStep, beatsPerBar: number): number {
  return (step.bar - 1) * beatsPerBar + (step.beat - 1);
}

function beatsOf(steps: StudyStep[], index: number, beatsPerBar: number): number {
  const start = beatPosition(steps[index], beatsPerBar);
  const next = steps[index + 1];
  if (next) {
    return Math.max(0.5, beatPosition(next, beatsPerBar) - start);
  }
  return beatsPerBar - ((steps[index].beat - 1) % beatsPerBar);
}

function micErrorText(hasDevice: boolean): string {
  return hasDevice
    ? "Permiso de micrófono denegado. Actívalo en el candado de la barra de direcciones."
    : "Este navegador no abrió el micrófono.";
}

export function PracticePage() {
  const song = useSession((state) => state.song);
  const study = useSession((state) => state.study);
  const token = useSession((state) => state.token);
  const practiceMelody = useSession((state) => state.practiceMelody);
  const setLastAttemptId = useSession((state) => state.setLastAttemptId);
  const record = useJourney((state) => state.record);
  const [drill, setDrill] = useState<Drill>("acorde");
  const [phase, setPhase] = useState<GamePhase>("idle");
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState(0);
  const [arrow, setArrow] = useState(-1);
  const [marks, setMarks] = useState<Record<number, Mark>>({});
  const [verdict, setVerdict] = useState("Pulsa Escuchar mi guitarra y toca el acorde.");
  const [listening, setListening] = useState(false);
  const [verdictKind, setVerdictKind] = useState<VerdictKind>("espera");
  const [speed, setSpeed] = useState(1);
  const [metronome, setMetronome] = useState(false);
  const [recentNotes, setRecentNotes] = useState<string[]>([]);
  const [melodyPosition, setMelodyPosition] = useState(0);
  const [melodyMarks, setMelodyMarks] = useState<NoteMark[]>([]);
  const sessionRef = useRef<ListeningSession | null>(null);
  const micTicketRef = useRef(0);
  const evidenceRef = useRef(new ChordEvidence());
  const followerRef = useRef<ChordScoreFollower | null>(null);
  const cursorRef = useRef(0);
  const savingRef = useRef(false);
  const listenRef = useRef<number[]>([]);
  const listenTicket = useRef(0);
  const symbolRef = useRef("");
  const drillRef = useRef<Drill>("acorde");
  drillRef.current = drill;

  const steps = song ? practiceSteps(song, study) : [];
  const beatsPerBar = song?.beatsPerBar ?? 4;
  const practicePattern = useSession((state) => state.practicePattern);
  const pattern = practicePattern ?? patternForTitle(song?.title ?? "");
  const melody = practiceMelody ?? melodyForTitle(song?.title ?? "");
  symbolRef.current = steps[picked]?.symbol ?? steps[0]?.symbol ?? "";
  const songSymbols = [...new Set(steps.map((item) => item.symbol))];
  const symbolsRef = useRef<string[]>([]);
  symbolsRef.current = songSymbols;

  function closeMicrophone() {
    // Invalida cualquier apertura en curso: el permiso puede llegar después de cerrar.
    micTicketRef.current += 1;
    window.clearInterval(cursorRef.current);
    sessionRef.current?.stop();
    sessionRef.current = null;
    setListening(false);
  }

  useEffect(() => {
    return () => {
      micTicketRef.current += 1;
      listenRef.current.forEach((id) => window.clearTimeout(id));
      window.clearInterval(cursorRef.current);
      sessionRef.current?.stop();
      sessionRef.current = null;
      stopGuitar();
    };
  }, []);

  useOnSignOut(() => {
    const micWasOn = listening || phase === "playing";
    closeMicrophone();
    listenRef.current.forEach((id) => window.clearTimeout(id));
    stopGuitar();
    setPhase("idle");
    setActive(-1);
    setMarks({});
    savingRef.current = false;
    if (micWasOn) {
      setVerdict("La sesión se cerró y el micrófono quedó apagado.");
      setVerdictKind("espera");
    }
  });

  async function openMicrophone(): Promise<MediaStream | null> {
    const ticket = micTicketRef.current;
    const media = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (!media) {
      setVerdict(micErrorText(false));
      setVerdictKind("no");
      return null;
    }
    try {
      const stream = await media(GUITAR_MIC);
      if (ticket !== micTicketRef.current) {
        stopTracks(stream);
        return null;
      }
      return stream instanceof MediaStream ? stream : null;
    } catch {
      if (ticket === micTicketRef.current) {
        setVerdict(micErrorText(true));
        setVerdictKind("no");
      }
      return null;
    }
  }

  /** Empieza a escuchar, salvo que el micrófono se haya cerrado mientras arrancaba. */
  async function listenTo(
    stream: MediaStream,
    options: Parameters<typeof startGuitarListener>[1],
    onEvent: (event: ListenerEvent) => void,
  ): Promise<ListeningSession | null> {
    const ticket = micTicketRef.current;
    const session = await startGuitarListener(stream, options, onEvent);
    if (ticket !== micTicketRef.current) {
      session.stop();
      return null;
    }
    sessionRef.current = session;
    return session;
  }

  /** Escucha libre de un acorde: cada rasgueo empieza un veredicto nuevo. */
  function onFreeChordEvent(event: ListenerEvent) {
    if (event.type === "onset") {
      evidenceRef.current = new ChordEvidence();
      return;
    }
    if (event.type !== "chord") {
      return;
    }
    const expected = symbolRef.current;
    if (!expected) {
      return;
    }
    const evidence = evidenceRef.current;
    evidence.add(event.chroma, event.windowSize, chordCandidates(expected, symbolsRef.current));
    const judgement = evidence.judge(expected);
    if (judgement.heard === null) {
      return;
    }
    const result = judgementVerdict(judgement.heard, judgement.ok, expected);
    setVerdict(
      drillRef.current === "rasgueo" && result.kind === "bien"
        ? `Bien. ${spanishName(expected)} con el rasgueo.`
        : result.text,
    );
    setVerdictKind(result.kind);
  }

  async function startListening() {
    closeMicrophone();
    const stream = await openMicrophone();
    if (!stream) {
      return;
    }
    record("tocar");
    evidenceRef.current = new ChordEvidence();
    setListening(true);
    setVerdict(`Escuchando. Toca ${spanishName(symbolRef.current)}.`);
    setVerdictKind("espera");
    await listenTo(stream, { chords: true, notes: false }, onFreeChordEvent);
  }

  async function startMelody() {
    closeMicrophone();
    const stream = await openMicrophone();
    if (!stream) {
      return;
    }
    record("tocar");
    const expected = melody;
    const follower = expected.length > 0 ? new MelodyFollower(expected) : null;
    setRecentNotes([]);
    setMelodyPosition(0);
    setMelodyMarks([]);
    setListening(true);
    setVerdictKind("espera");
    setVerdict(
      follower ? `Escuchando. Toca ${noteLabel(expected[0])}.` : "Escuchando. Toca cualquier nota.",
    );
    await listenTo(stream, { chords: false, notes: true }, (event) => {
      if (event.type !== "note") {
        return;
      }
      const heard = noteLabel(event.midi);
      setRecentNotes((current) => [...current, heard].slice(-RECENT_NOTES));
      if (!follower) {
        setVerdict(`Se oye ${heard}.`);
        setVerdictKind("bien");
        return;
      }
      if (follower.done) {
        return;
      }
      const progress = follower.hear(event.midi);
      setMelodyPosition(progress.position);
      setMelodyMarks(progress.marks);
      if (follower.done) {
        setVerdict(`Melodía completa. Acertaste ${Math.round(follower.accuracy())} %.`);
        setVerdictKind("bien");
        return;
      }
      const next = noteLabel(expected[progress.position]);
      setVerdict(progress.matched ? `Bien. Sigue ${next}.` : `Se oye ${heard}, toca ${next}.`);
      setVerdictKind(progress.matched ? "bien" : "no");
    });
  }

  async function finish() {
    const follower = followerRef.current;
    const session = sessionRef.current;
    if (savingRef.current || !song || drillRef.current !== "progresion") {
      return;
    }
    const latencyMs = Math.round((session?.latency ?? 0) * 1000);
    savingRef.current = true;
    closeMicrophone();
    setActive(-1);
    setPhase("finished");
    if (!useSession.getState().scoreTiming) {
      setVerdict("Este ritmo es un supuesto de la carta. Corrígelo en la guía antes de puntuar.");
      setVerdictKind("espera");
      return;
    }
    if (!token) {
      setVerdict("Práctica terminada. No se guardó.");
      setVerdictKind("espera");
      return;
    }
    const events = steps.map((step, index) => {
      const result = follower?.result(index);
      const heard = result?.judgement.heard ?? null;
      const delta = result?.deltaMs ?? null;
      return {
        bar: step.bar,
        expected: step.symbol,
        detected: heard,
        // Sin ataque pero con el acorde sonando: se dejó vibrar y no llegó tarde.
        deltaMs: heard === null ? MISSED_DELTA_MS : delta === null ? 0 : delta - latencyMs,
        confidence: result?.judgement.score ?? 0,
      };
    });
    const bpm = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(song.bpm * speed)));
    try {
      const saved = await new ApiClient(apiUrl, fetch, token).createAttempt(
        song.id,
        bpm,
        events,
        Math.max(-MAX_LATENCY_MS, Math.min(MAX_LATENCY_MS, latencyMs)),
      );
      setLastAttemptId(saved.id);
      setVerdict(`Intento guardado. Precisión ${Math.round(saved.accuracy)}%.`);
      setVerdictKind("espera");
    } catch (error) {
      savingRef.current = false;
      setVerdict(error instanceof ApiError ? error.message : "No se pudo guardar el intento.");
      setVerdictKind("no");
    }
  }

  async function begin() {
    if (!song || drillRef.current !== "progresion") {
      return;
    }
    closeMicrophone();
    savingRef.current = false;
    setMarks({});
    setActive(0);
    setPhase("playing");
    setVerdict(
      token ? "Prepárate: cuenta de entrada." : "Prepárate. Esta práctica no se guardará.",
    );
    setVerdictKind("espera");
    const ticket = micTicketRef.current;
    const stream = await openMicrophone();
    if (!stream) {
      if (ticket === micTicketRef.current) {
        setPhase("idle");
      }
      return;
    }
    record("tocar");
    const onEvent = (event: ListenerEvent) => {
      if (event.type === "onset") {
        followerRef.current?.addOnset(event.at);
      } else if (event.type === "chord") {
        followerRef.current?.addChroma(event.onsetAt, event.at, event.windowSize, event.chroma);
      }
    };
    const session = await listenTo(stream, { chords: true, notes: false }, onEvent);
    if (!session) {
      return;
    }

    const secondsPerBeat = 60 / (song.bpm * speed);
    const countIn = Math.round(beatsPerBar);
    const firstBeat = session.now() + START_MARGIN_SECONDS;
    const origin = firstBeat + countIn * secondsPerBeat;
    const firstPosition = beatPosition(steps[0], beatsPerBar);
    const slots: ChordSlot[] = steps.map((step, index) => {
      const at = origin + (beatPosition(step, beatsPerBar) - firstPosition) * secondsPerBeat;
      return {
        symbol: step.symbol,
        at,
        end: at + beatsOf(steps, index, beatsPerBar) * secondsPerBeat,
      };
    });
    const songEnd = slots[slots.length - 1].end;
    const totalBeats = metronome ? Math.ceil((songEnd - firstBeat) / secondsPerBeat) : countIn;
    for (let beat = 0; beat < totalBeats; beat += 1) {
      session.click(firstBeat + beat * secondsPerBeat, beat % countIn === 0);
    }
    const symbols = symbolsRef.current;
    const follower = new ChordScoreFollower(slots, (symbol) => chordCandidates(symbol, symbols));
    followerRef.current = follower;

    let closed = 0;
    let lastIndex = -1;
    let started = false;
    cursorRef.current = window.setInterval(() => {
      const time = session.now();
      if (time < origin) {
        const left = Math.ceil((origin - time) / secondsPerBeat);
        setVerdict(`Empieza en ${left}…`);
        return;
      }
      if (!started) {
        started = true;
        setVerdict("Toca cada acorde cuando se ilumine.");
      }
      const index = follower.indexAt(time);
      if (index >= 0 && index !== lastIndex) {
        lastIndex = index;
        setActive(index);
        setPicked(index);
      }
      while (closed < slots.length && time > slots[closed].end + SLOT_GRACE_SECONDS) {
        const result = follower.result(closed);
        const position = closed;
        const expected = slots[closed].symbol;
        const said = judgementVerdict(result.judgement.heard, result.judgement.ok, expected);
        setMarks((current) => ({ ...current, [position]: result.judgement.ok ? "bien" : "no" }));
        setVerdict(said.text);
        setVerdictKind(said.kind);
        closed += 1;
      }
      if (time > songEnd + FINISH_GRACE_SECONDS) {
        void finish();
      }
    }, CURSOR_TICK_MS);
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
    closeMicrophone();
    setDrill(next);
    setPhase("idle");
    setActive(-1);
    setMarks({});
    savingRef.current = false;
    const symbol = steps[picked]?.symbol ?? steps[0]?.symbol;
    setVerdict(
      next === "progresion"
        ? "Pulsa Empezar: habrá una cuenta de entrada y luego toca cada acorde."
        : next === "melodia"
          ? "Pulsa Escuchar mi guitarra y toca nota por nota."
          : symbol
            ? `Pulsa Escuchar mi guitarra y toca ${spanishName(symbol)}.`
            : "Pulsa Escuchar mi guitarra y toca el acorde.",
    );
    setVerdictKind("espera");
  }

  function pick(index: number) {
    setPicked(index);
    evidenceRef.current = new ChordEvidence();
  }

  if (!song) {
    return (
      <main className="page">
        <PageHeader icon="mic" eyebrow="Paso 3: a tocar" title="Práctica">
          Tocas tu guitarra y la app te escucha para decirte si el acorde suena bien.
        </PageHeader>
        <EmptyState icon="guitar" title="Primero elige una canción">
          <p>Elige una canción en la biblioteca. Las primeras son muy fáciles.</p>
          <Link className="button" to="/biblioteca">
            Abrir biblioteca
          </Link>
        </EmptyState>
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
  const playing = phase === "playing";
  const melodyStart = Math.max(0, melodyPosition - 4);

  function hearChart() {
    record("tocar");
    listenTicket.current += 1;
    const ticket = listenTicket.current;
    listenRef.current.forEach((id) => window.clearTimeout(id));
    listenRef.current = [];
    const lengths = steps.map((_, position) => beatsOf(steps, position, beatsPerBar));
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
    <main
      className="page"
      tabIndex={0}
      onKeyDown={(event) => {
        // Espacio y Enter ya activan el control enfocado: no deben iniciar otra acción.
        if (!(event.target as HTMLElement).closest("button, a, input, select")) {
          onKeyDown(event.key);
        }
      }}
    >
      <PageHeader icon="mic" eyebrow="Carta en curso" title={song.title}>
        {song.artist} · {song.bpm} <Term id="bpm">BPM</Term>
      </PageHeader>

      <div className="drill-picker" role="group" aria-label="Modalidad de práctica">
        {DRILLS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="drill-card"
            aria-pressed={drill === item.id}
            onClick={() => choose(item.id)}
          >
            {item.title}
            <small>{item.text}</small>
          </button>
        ))}
      </div>

      {token ? null : (
        <p className="note">
          Puedes practicar sin entrar. Esta práctica no se guardará.{" "}
          <Link to="/entrar">Inicia sesión</Link> para conservarla.
        </p>
      )}

      <section className="panel practice-console" aria-label="Lo que escucha la app">
        <div className="stack">
          <p className={`verdict is-${verdictKind}`} role="status">
            {verdict}
          </p>
          <p className="hint">
            {drill === "melodia"
              ? "Toca una nota a la vez y deja de tocar las demás cuerdas."
              : "El micrófono compara las notas que suenan con las del acorde."}{" "}
            El audio no sale de este navegador.
          </p>
        </div>
        <div className="actions">
          {drill === "progresion" ? (
            <>
              <button
                type="button"
                className="button-large"
                disabled={playing}
                onClick={() => onKeyDown(" ")}
              >
                <Icon name="play" />
                Empezar
              </button>
              <button
                className="button-ghost button-large"
                type="button"
                onClick={() => void finish()}
              >
                Cerrar intento
              </button>
            </>
          ) : (
            <button
              type="button"
              className={listening ? "button-large is-listening" : "button-large"}
              aria-pressed={listening}
              onClick={() => {
                if (listening) {
                  closeMicrophone();
                } else {
                  void (drill === "melodia" ? startMelody() : startListening());
                }
              }}
            >
              <Icon name={listening ? "stop" : "mic"} />
              {listening ? "Dejar de escuchar" : "Escuchar mi guitarra"}
            </button>
          )}
        </div>
      </section>

      {drill === "progresion" ? (
        <section className="panel player-toggles" aria-label="Ajustes del intento">
          <label>
            Velocidad
            <select
              value={speed}
              disabled={playing}
              onChange={(event) => setSpeed(Number(event.target.value))}
            >
              {SPEEDS.map((value) => (
                <option key={value} value={value}>
                  {Math.round(value * 100)} % ({Math.round(song.bpm * value)} BPM)
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={metronome}
              disabled={playing}
              onChange={(event) => setMetronome(event.target.checked)}
            />
            <span>
              <Term id="metronomo">Metrónomo</Term> (mejor con audífonos)
            </span>
          </label>
        </section>
      ) : null}

      {drill === "melodia" ? (
        <section className="panel stack" aria-label="Notas">
          {melody.length > 0 ? (
            <>
              <h2>Melodía de la canción</h2>
              <ol className="note-track">
                {melody.slice(melodyStart, melodyStart + MELODY_VIEW).map((midi, offset) => {
                  const index = melodyStart + offset;
                  const mark = melodyMarks[index];
                  const classes = ["note-chip"];
                  if (index === melodyPosition) {
                    classes.push("is-now");
                  }
                  if (mark) {
                    classes.push(`is-${mark}`);
                  }
                  return (
                    <li key={index} className={classes.join(" ")}>
                      {noteLabel(midi)}
                    </li>
                  );
                })}
              </ol>
              <p className="hint">
                Nota {Math.min(melodyPosition + 1, melody.length)} de {melody.length}. Si te saltas
                una, la app sigue contigo.
              </p>
            </>
          ) : (
            <p className="hint">
              Esta canción no trae melodía escrita. Toca lo que quieras y mira qué nota oye la app.
              Las canciones subidas con su tablatura sí traen la melodía para seguirla.
            </p>
          )}
          <div>
            <h3>Últimas notas que oí</h3>
            {recentNotes.length === 0 ? (
              <p className="hint">Todavía ninguna.</p>
            ) : (
              <ol className="note-track">
                {recentNotes.map((name, index) => (
                  <li key={`${name}-${index}`} className="note-chip">
                    {name}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="stack" aria-label="Acordes de la canción">
            <p className="hint">
              Esta es la <Term id="carta">carta</Term>: toca un acorde para verlo.
            </p>
            <ol className="chart" aria-label="Carta">
              {boxes.map((box, index) => (
                <li
                  key={`${box.x}-${box.symbol}`}
                  className={index === shown ? "is-now" : undefined}
                >
                  <button type="button" className="chart-hit" onClick={() => pick(index)}>
                    {box.symbol}
                    <small>
                      {marks[index] === "bien"
                        ? "Bien"
                        : marks[index] === "no"
                          ? "No"
                          : `${beatsOf(steps, index, beatsPerBar)} t`}
                    </small>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          {step ? (
            <section className="panel practice-chord">
              <ChordFigure symbol={step.symbol} />
              <div className="practice-chord-tools">
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
                ) : (
                  <p className="hint">
                    Los puntos son tus dedos, las líneas verticales son las cuerdas y las
                    horizontales, los trastes.
                  </p>
                )}
                {drill === "rasgueo" ? (
                  <p className="hint">
                    <GlossaryText text={pattern.hint} />
                  </p>
                ) : null}
                <div className="actions">
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => {
                      void shapeFor(step.symbol).then((found) => {
                        if (found) {
                          playChord(found);
                        }
                      });
                    }}
                  >
                    <Icon name="sound" size={18} />
                    Escuchar el acorde
                  </button>
                  {drill !== "acorde" ? (
                    <button
                      type="button"
                      className="button-ghost"
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
                      <Icon name="sound" size={18} />
                      Escuchar el rasgueo
                    </button>
                  ) : null}
                  {drill === "progresion" ? (
                    <button type="button" className="button-ghost" onClick={hearChart}>
                      <Icon name="sound" size={18} />
                      Escuchar la canción
                    </button>
                  ) : null}
                </div>
                <div className="actions">
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => pick(Math.max(0, shown - 1))}
                  >
                    <Icon name="arrowLeft" size={18} />
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => pick(Math.min(steps.length - 1, shown + 1))}
                  >
                    Siguiente
                    <Icon name="arrowRight" size={18} />
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}

      {study ? <p className="hint">{study.summary}</p> : null}
      {drill === "progresion" ? (
        <p className="hint">
          <span className="keyboard-hint">Espacio empieza. Enter cierra el intento. </span>
          <Link to="/informe">Ver el informe</Link>
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
