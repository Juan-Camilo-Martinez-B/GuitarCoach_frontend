import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import { guideFromWire } from "../api/guides";
import {
  playChord,
  playGuide,
  playPattern,
  playStrum,
  stopGuitar,
  warmShape,
} from "../audio/guitarTone";
import { shapeFor, spanishName, type ChordShape } from "../chords/shapes";
import type { StrumHit } from "../domain/course";
import {
  bpmFromUs,
  chordChangeLabels,
  ensureGrid,
  eventsInBar,
  firstPlayedSection,
  guideHits,
  hasInferredTiming,
  hasWrittenMelody,
  lessonHint,
  prepareLesson,
  pulseToSeconds,
  sectionPattern,
  songFromGuide,
  soundingMelody,
  strumBar,
  SOURCE_LABEL,
  totalBeats,
  usAt,
  type GuideHit,
  type GuideRecord,
  type GuideStatus,
  type SongGuide,
} from "../domain/guide";
import { useJourney } from "../store/journey";
import { rememberVisit } from "../store/lastVisit";
import { useSession } from "../store/session";
import { ChordFigure } from "../ui/ChordDiagram";
import { GuideEditor } from "../ui/GuideEditor";
import { Icon } from "../ui/Icon";
import { EmptyState, PageHeader } from "../ui/PageHeader";
import { StatusMessage } from "../ui/StatusMessage";
import { queueStrumMarks } from "../ui/strumMarks";
import { StrumRail } from "../ui/StrumRail";
import { Term } from "../ui/Term";
import { isGenericPartName } from "../tab/songParts";

// alphaTab pesa más que el resto de la app: solo se descarga si la guía trae tablatura.
const TabPlayer = lazy(() =>
  import("../ui/TabPlayer").then((module) => ({ default: module.TabPlayer })),
);

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const RATES = [0.75, 0.85, 1, 1.1, 1.2, 1.275, 1.3, 1.45];

type Drill = "acorde" | "rasgueo" | "progresion";

const DRILLS: Array<{ id: Drill; title: string; text: string }> = [
  {
    id: "acorde",
    title: "Acorde solo",
    text: "Mira dónde van los dedos y escucha el acorde.",
  },
  {
    id: "rasgueo",
    title: "Acorde y rasgueo",
    text: "Suma el movimiento de la mano con las flechas.",
  },
  {
    id: "progresion",
    title: "Progresión",
    text: "Sigue los acordes de la parte elegida, uno tras otro.",
  },
];

function beatLabel(beats: number): string {
  const rounded = Math.round(beats * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Acordes que suenan en la parte elegida: toda la canción o una sola sección. */
function chordsInPart(guide: SongGuide, range: number | "all"): number[] {
  if (range === "all") {
    return guide.chords.map((_, index) => index);
  }
  const section = guide.sections[range];
  if (!section) {
    return [];
  }
  const from = section.start;
  const to = section.start + section.beats;
  return guide.chords.flatMap((chord, index) =>
    chord.start < to - 1e-6 && from < chord.start + chord.beats - 1e-6 ? [index] : [],
  );
}

interface Now {
  chord: number;
  section: number;
  hit: number;
  event: number;
}

/** Los compases de una sección, cada uno con los índices de los acordes que empiezan en él. */
function sectionBars(guide: SongGuide, sectionIndex: number): number[][] {
  const section = guide.sections[sectionIndex];
  const bars: number[][] = [];
  for (
    let start = section.start;
    start < section.start + section.beats - 1e-6;
    start += guide.beats_per_bar
  ) {
    const inside = guide.chords.flatMap((chord, index) =>
      chord.start >= start - 1e-6 && chord.start < start + guide.beats_per_bar - 1e-6
        ? [index]
        : [],
    );
    bars.push(inside);
  }
  return bars;
}

export function GuidePage() {
  const { guideId = "" } = useParams();
  const token = useSession((state) => state.token);
  const notice = useSession((state) => state.notice);
  const setSong = useSession((state) => state.setSong);
  const setStudy = useSession((state) => state.setStudy);
  const setPracticePattern = useSession((state) => state.setPracticePattern);
  const setScoreTiming = useSession((state) => state.setScoreTiming);
  const navigate = useNavigate();
  const [record, setRecord] = useState<GuideRecord | null>(null);
  const [shapes, setShapes] = useState<Array<ChordShape | null>>([]);
  const [range, setRange] = useState<number | "all">("all");
  const [rate, setRate] = useState(1);
  const [countIn, setCountIn] = useState(true);
  const [metronome, setMetronome] = useState(false);
  const [withMelody, setWithMelody] = useState(false);
  const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState<Now | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [drill, setDrill] = useState<Drill>("acorde");
  const [arrow, setArrow] = useState(-1);
  const [editing, setEditing] = useState(false);
  // Con tablatura se elige la vista; por defecto, acordes y rasgueo para tocar.
  const [view, setView] = useState<"acordes" | "partitura">("acordes");
  const [state, setState] = useState<"idle" | "loading" | "error">("loading");
  const [message, setMessage] = useState("");
  const timers = useRef<number[]>([]);
  const loopRef = useRef(loop);
  loopRef.current = loop;

  const source = record?.guide ?? null;
  const [tab, setTab] = useState<ArrayBuffer | null>(null);
  const hasTab = record?.sourceKind === "tablatura";

  useEffect(() => {
    if (!hasTab || !token) {
      setTab(null);
      return;
    }
    let live = true;
    void new ApiClient(apiUrl, fetch, token)
      .guideTab(guideId)
      .then((bytes) => live && setTab(bytes))
      .catch(() => live && setMessage("No se pudo abrir la tablatura de esta guía."));
    return () => {
      live = false;
    };
  }, [guideId, hasTab, token]);
  const guide = useMemo(() => (source ? prepareLesson(ensureGrid(source)) : null), [source]);
  const writtenMelody = useMemo(() => (source ? hasWrittenMelody(source) : false), [source]);
  // En una tablatura sin punteo no hay melodía: no se ofrece la guía armónica en su lugar.
  const melody = useMemo(
    () => (guide && !(hasTab && !writtenMelody) ? soundingMelody(guide) : []),
    [guide, hasTab, writtenMelody],
  );

  // La guía armónica no es la canción: solo suena si el alumno la pide.
  useEffect(() => {
    setWithMelody(writtenMelody);
  }, [writtenMelody]);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setState("loading");
    try {
      const client = new ApiClient(apiUrl, fetch, token);
      let loaded = await client.guide(guideId);
      const unnamed = loaded.guide.sections.every((section) => isGenericPartName(section.name));
      if (loaded.sourceKind === "tablatura" && loaded.guide.sections.length > 0 && unnamed) {
        try {
          const bytes = new Uint8Array(await client.guideTab(guideId));
          const { readTabBytes } = await import("../tab/readTab");
          const fresh = await readTabBytes(bytes, loaded.title);
          loaded = await client.updateGuide(guideId, guideFromWire(fresh), loaded.status);
        } catch {
          // Si el archivo no se puede volver a leer, se queda la guía que ya estaba guardada.
        }
      }
      setRecord(loaded);
      rememberVisit({ path: `/canciones/${guideId}`, label: `Seguir con ${loaded.title}` });
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo abrir la guía.");
    }
  }, [guideId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const chordKey = guide?.chords.map((chord) => chord.chord).join("|") ?? "";
  useEffect(() => {
    if (!chordKey) {
      return;
    }
    let live = true;
    const symbols = chordKey.split("|");
    const unique = [...new Set(symbols)];
    void Promise.all(unique.map((symbol) => shapeFor(symbol))).then((found) => {
      if (!live) {
        return;
      }
      const bySymbol = new Map(unique.map((symbol, index) => [symbol, found[index]]));
      found.forEach((shape) => shape && warmShape(shape));
      setShapes(symbols.map((symbol) => bySymbol.get(symbol) ?? null));
    });
    return () => {
      live = false;
    };
  }, [chordKey]);

  const stop = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    loopRef.current = false;
    stopGuitar();
    setPlaying(false);
    setNow(null);
    setArrow(-1);
  }, []);

  useEffect(() => stop, [stop]);

  const play = useCallback(async () => {
    if (!guide) {
      return;
    }
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    const section = range === "all" ? null : guide.sections[range];
    const from = section ? section.start : 0;
    const to = section ? section.start + section.beats : totalBeats(guide);
    const hits = guideHits(guide, from, to);
    const notes = withMelody
      ? melody
          .filter((note) => note.start >= from - 1e-6 && note.start < to - 1e-6)
          .map((note) => ({ ...note, start: note.start - from }))
      : [];
    useJourney.getState().record();
    setPlaying(true);
    let delay: number | null;
    try {
      delay = await playGuide({
        shapes,
        hits,
        notes,
        tempo: guide.tempo ?? [{ pulse: 0, usPerQuarter: 500_000 }],
        rate,
        from,
        beatsPerBar: guide.beats_per_bar,
        countIn: countIn ? Math.round(guide.beats_per_bar) : 0,
        metronome,
        length: to - from,
        capo: guide.capo,
      });
    } catch {
      setPlaying(false);
      return;
    }
    if (delay === null) {
      setPlaying(false);
      return;
    }
    const seconds = (pulse: number) =>
      pulseToSeconds(from + pulse, guide.tempo ?? [], rate) -
      pulseToSeconds(from, guide.tempo ?? [], rate);
    const marks: StrumHit[] = hits.map((hit, index) => ({
      at: delay + seconds(hit.at),
      slot: index,
      hit: hit.hit,
      hold: Math.max(0.05, seconds(hit.at + hit.hold) - seconds(hit.at)),
    }));
    timers.current = queueStrumMarks(
      marks,
      (mark) => {
        const hit: GuideHit = hits[mark.slot];
        setNow({ chord: hit.chord, section: hit.section, hit: hit.hit, event: hit.event });
      },
      () => {
        if (loopRef.current) {
          void play();
          return;
        }
        setPlaying(false);
        setNow(null);
      },
    );
  }, [countIn, guide, melody, metronome, range, rate, shapes, withMelody]);

  async function save(next: SongGuide, status: GuideStatus) {
    setState("loading");
    try {
      setRecord(await new ApiClient(apiUrl, fetch, token).updateGuide(guideId, next, status));
      setEditing(false);
      setState("idle");
      setMessage(status === "revisada" ? "Guía revisada y guardada." : "Borrador guardado.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo guardar la guía.");
    }
  }

  async function remove() {
    if (!window.confirm("¿Eliminar esta canción y su archivo? No se puede deshacer.")) {
      return;
    }
    stop();
    setState("loading");
    try {
      await new ApiClient(apiUrl, fetch, token).deleteGuide(guideId);
      navigate("/canciones");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo eliminar la canción.");
    }
  }

  async function practice() {
    if (!record || !guide) {
      return;
    }
    const song = songFromGuide(record);
    if (!song) {
      return;
    }
    stop();
    setSong(song);
    const sectionIndex = range === "all" ? 0 : range;
    const section = guide.sections[sectionIndex];
    const inferred = hasInferredTiming(guide, section.start, section.start + section.beats);
    setScoreTiming(!inferred);
    setPracticePattern(inferred ? null : sectionPattern(guide, sectionIndex));
    try {
      setStudy(await new ApiClient(apiUrl, fetch, token).songStudy(song.id));
    } catch {
      setStudy(null);
    }
    navigate("/practica");
  }

  const opening = useMemo(() => (guide ? firstPlayedSection(guide) : 0), [guide]);
  const focusSection = now?.section ?? (range === "all" ? opening : range);
  const focusChord = useMemo(() => {
    if (!guide) {
      return -1;
    }
    if (now) {
      return now.chord;
    }
    if (chosen !== null && guide.chords[chosen]) {
      return chosen;
    }
    const start = guide.sections[focusSection]?.start ?? 0;
    // El acorde que está sonando cuando empieza la sección, aunque venga de antes.
    const sounding = guide.chords.findIndex(
      (chord) => chord.start <= start + 1e-6 && start < chord.start + chord.beats - 1e-6,
    );
    return sounding >= 0
      ? sounding
      : guide.chords.findIndex((chord) => chord.start >= start - 1e-6);
  }, [chosen, focusSection, guide, now]);

  const shownEvents = useMemo(() => {
    if (!guide) {
      return [];
    }
    const pulse = now ? guide.events?.[now.event]?.pulse : undefined;
    if (pulse !== undefined) {
      return eventsInBar(guide, pulse);
    }
    return strumBar(guide, focusSection);
  }, [focusSection, guide, now]);

  const changeLabels = useMemo(
    () => (guide ? chordChangeLabels(guide, shownEvents) : []),
    [guide, shownEvents],
  );

  const strikePattern = useMemo(() => {
    const base = guide
      ? sectionPattern(guide, focusSection)
      : { directions: ["abajo" as const], beats: [1], hint: "" };
    const strikes = shownEvents.filter((event) => event.contact !== "aire");
    if (strikes.length === 0) {
      return base;
    }
    return {
      directions: strikes.map((event) => event.direction),
      beats: strikes.map((event) => event.span),
      hint: base.hint,
    };
  }, [focusSection, guide, shownEvents]);

  const partIndices = useMemo(() => (guide ? chordsInPart(guide, range) : []), [guide, range]);

  if (!token) {
    return (
      <main className="page">
        <EmptyState icon="lock">
          <p>{notice ?? "Inicia sesión para abrir tus guías."}</p>
          <Link className="button" to="/entrar">
            Iniciar sesión
          </Link>
        </EmptyState>
      </main>
    );
  }

  if (!record || !guide) {
    return (
      <main className="page">
        <StatusMessage state={state} message={message} />
        <Link className="button button-ghost" to="/canciones">
          <Icon name="arrowLeft" size={18} />
          Volver a mis canciones
        </Link>
      </main>
    );
  }

  const current = guide.chords[focusChord];
  const partPlace = Math.max(0, partIndices.indexOf(focusChord));
  const strikeActive = now
    ? shownEvents.slice(0, now.hit + 1).filter((event) => event.contact !== "aire").length - 1
    : arrow;

  return (
    <main className="page">
      <Link className="back-link" to="/canciones">
        <Icon name="arrowLeft" size={18} />
        Mis canciones
      </Link>
      <PageHeader
        icon="music"
        eyebrow={SOURCE_LABEL[record.sourceKind] ?? record.sourceKind}
        title={guide.title}
      >
        {guide.artist}
        <div className="chip-row">
          <span className="chip">
            {Math.round(bpmFromUs(usAt(0, guide.tempo ?? [])) * rate)} <Term id="bpm">BPM</Term>
          </span>
          <span className="chip">
            <Term id="compas">Compás</Term> de {guide.beats_per_bar}
          </span>
          {guide.tempo && guide.tempo.length > 1 ? (
            <span className="chip">El tempo cambia en la canción</span>
          ) : null}
          {guide.capo > 0 ? (
            <span className="chip">
              <Term id="cejilla">Cejilla</Term> en el traste {guide.capo}
            </span>
          ) : null}
          <span className={`guide-status is-${record.status}`}>
            {record.status === "revisada" ? "Revisada" : "Borrador: revisa los acordes"}
          </span>
        </div>
      </PageHeader>
      {guide.events?.some((event) => event.origin === "leccion") ? (
        <p className="note">{lessonHint(guide.beats_per_bar)} Escucha y luego tócalo igual.</p>
      ) : null}
      {writtenMelody || hasTab ? null : (
        <p className="note">
          Esta guía solo trae acordes, no las notas de la canción. Para oír cada nota tal como
          suena, sube su tablatura de Guitar Pro en <Link to="/canciones">Mis canciones</Link>.
        </p>
      )}

      <StatusMessage state={state} message={message} />
      {state === "idle" && message ? (
        <p className="status-pill guide-saved" role="status">
          {message}
        </p>
      ) : null}

      {editing ? (
        <GuideEditor
          guide={guide}
          saving={state === "loading"}
          onSave={(next, status) => void save(next, status)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="guide-toolbar">
          {hasTab ? (
            <div className="auth-switch guide-view" role="group" aria-label="Vista de la canción">
              <button
                type="button"
                aria-pressed={view === "acordes"}
                onClick={() => setView("acordes")}
              >
                Acordes y rasgueo
              </button>
              <button
                type="button"
                aria-pressed={view === "partitura"}
                onClick={() => {
                  stop();
                  setView("partitura");
                }}
              >
                Partitura
              </button>
            </div>
          ) : (
            <span />
          )}
          <div className="actions">
            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                stop();
                setEditing(true);
              }}
            >
              <Icon name="edit" size={18} />
              Ajustar la carta
            </button>
            <button
              type="button"
              className="button-ghost button-danger"
              onClick={() => void remove()}
            >
              Eliminar
            </button>
          </div>
        </div>
      )}

      {!editing && hasTab && view === "partitura" ? (
        tab ? (
          <Suspense fallback={<p className="hint">Cargando la tablatura...</p>}>
            <TabPlayer data={tab} />
          </Suspense>
        ) : (
          <p className="hint">Cargando la tablatura...</p>
        )
      ) : null}

      {editing || (hasTab && view === "partitura") ? null : (
        <>
          <section className="panel guide-player" aria-label="Reproductor">
            <div className="actions player-actions">
              {playing ? (
                <button type="button" className="button-large is-listening" onClick={stop}>
                  <Icon name="stop" />
                  Detener
                </button>
              ) : (
                <button
                  type="button"
                  className="button-large"
                  onClick={() => void play()}
                  disabled={shapes.length === 0}
                >
                  <Icon name="play" />
                  Escuchar
                </button>
              )}
              <button
                type="button"
                className="button-ghost button-large"
                onClick={() => void practice()}
              >
                <Icon name="mic" />
                Practicar con el micrófono
              </button>
            </div>
            <div className="player-controls">
              <label>
                Qué parte tocar
                <select
                  value={range === "all" ? "all" : String(range)}
                  onChange={(event) => {
                    stop();
                    setChosen(null);
                    setArrow(-1);
                    setRange(event.target.value === "all" ? "all" : Number(event.target.value));
                  }}
                >
                  <option value="all">Toda la canción</option>
                  {guide.sections.map((section, index) => (
                    <option key={`${section.name}-${index}`} value={index}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Velocidad: {Math.round(rate * 100)} % (
                {Math.round(bpmFromUs(usAt(0, guide.tempo ?? [])) * rate)} BPM)
                <input
                  type="range"
                  min={0}
                  max={RATES.length - 1}
                  step={1}
                  value={RATES.indexOf(rate)}
                  onChange={(event) => setRate(RATES[Number(event.target.value)])}
                />
              </label>
            </div>
            <div className="player-toggles">
              <label className="check">
                <input
                  type="checkbox"
                  checked={countIn}
                  onChange={(event) => setCountIn(event.target.checked)}
                />
                <Term id="cuenta-entrada">Cuenta de entrada</Term>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={metronome}
                  onChange={(event) => setMetronome(event.target.checked)}
                />
                <Term id="metronomo">Metrónomo</Term>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={(event) => setLoop(event.target.checked)}
                />
                Repetir
              </label>
              {melody.length > 0 ? (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={withMelody}
                    onChange={(event) => setWithMelody(event.target.checked)}
                  />
                  {writtenMelody ? "Melodía" : <Term id="guia-armonica">Guía armónica</Term>}
                </label>
              ) : null}
            </div>
          </section>

          <div className="drill-picker" role="group" aria-label="Cómo estudiar esta parte">
            {DRILLS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="drill-card"
                aria-pressed={drill === item.id}
                onClick={() => {
                  setArrow(-1);
                  setDrill(item.id);
                }}
              >
                {item.title}
                <small>{item.text}</small>
              </button>
            ))}
          </div>

          <section className="stack" aria-label="Acordes de la parte">
            <p className="hint">
              Esta es la <Term id="carta">carta</Term> de{" "}
              {range === "all" ? "toda la canción" : (guide.sections[range]?.name ?? "esta parte")}.
              Toca un acorde para verlo.
            </p>
            {partIndices.length === 0 ? (
              <p className="hint">Esta parte no tiene acordes.</p>
            ) : (
              <ol className="chart" aria-label="Carta">
                {partIndices.map((index) => {
                  const chord = guide.chords[index];
                  return (
                    <li
                      key={`${chord.chord}-${chord.start}`}
                      className={index === focusChord ? "is-now" : undefined}
                    >
                      <button
                        type="button"
                        className="chart-hit"
                        onClick={() => {
                          if (playing) {
                            return;
                          }
                          setChosen(index);
                          setArrow(-1);
                          const shape = shapes[index];
                          if (shape) {
                            playChord(shape);
                          }
                        }}
                      >
                        {chord.chord}
                        <small>{beatLabel(chord.beats)} t</small>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {current ? (
            <section className="panel practice-chord">
              <ChordFigure symbol={current.chord} />
              <div className="practice-chord-tools">
                {drill === "acorde" ? (
                  <p className="hint">
                    Los puntos son tus dedos, las líneas verticales son las cuerdas y las
                    horizontales, los trastes.
                  </p>
                ) : (
                  <>
                    <StrumRail
                      pattern={strikePattern}
                      active={strikeActive}
                      marks={changeLabels
                        .filter((_, index) => shownEvents[index]?.contact !== "aire")
                        .map((label) => (label ? spanishName(label) : null))}
                      onStrum={(direction) => {
                        const shape = shapes[focusChord];
                        if (shape && !playing) {
                          playStrum(shape, direction, guide.capo);
                        }
                      }}
                    />
                    {strikePattern.hint ? <p className="hint">{strikePattern.hint}</p> : null}
                    <p className="hint">
                      La etiqueta sobre una flecha marca el golpe en el que cambia el acorde. El
                      diagrama de la izquierda cambia con él.
                    </p>
                  </>
                )}
                <div className="actions">
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => {
                      const shape = shapes[focusChord];
                      if (shape && !playing) {
                        playChord(shape);
                      }
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
                        const shape = shapes[focusChord];
                        if (!shape || playing) {
                          return;
                        }
                        timers.current.forEach((id) => window.clearTimeout(id));
                        void playPattern(
                          shape,
                          Math.round(bpmFromUs(usAt(0, guide.tempo ?? [])) * rate),
                          strikePattern,
                        ).then((hits) => {
                          if (hits.length === 0) {
                            return;
                          }
                          timers.current = queueStrumMarks(
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
                    <button
                      type="button"
                      className="button-ghost"
                      disabled={!playing && shapes.length === 0}
                      onClick={() => {
                        if (playing) {
                          stop();
                          return;
                        }
                        void play();
                      }}
                    >
                      <Icon name={playing ? "stop" : "sound"} size={18} />
                      {playing
                        ? "Detener"
                        : range === "all"
                          ? "Escuchar la canción"
                          : "Escuchar la progresión"}
                    </button>
                  ) : null}
                </div>
                <div className="actions">
                  <button
                    type="button"
                    className="button-ghost"
                    disabled={partPlace <= 0}
                    onClick={() => {
                      const previous = partIndices[partPlace - 1];
                      if (previous === undefined || playing) {
                        return;
                      }
                      setChosen(previous);
                      setArrow(-1);
                    }}
                  >
                    <Icon name="arrowLeft" size={18} />
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="button-ghost"
                    disabled={partPlace >= partIndices.length - 1}
                    onClick={() => {
                      const next = partIndices[partPlace + 1];
                      if (next === undefined || playing) {
                        return;
                      }
                      setChosen(next);
                      setArrow(-1);
                    }}
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

      <section className="guide-sheet" aria-label="Carta de la canción">
        {guide.sections.map((section, sectionIndex) =>
          range !== "all" && sectionIndex !== range ? null : (
            <article
              key={`${section.name}-${sectionIndex}`}
              className={sectionIndex === focusSection ? "sheet-section is-now" : "sheet-section"}
            >
              <header>
                <button
                  type="button"
                  className="button-ghost"
                  aria-pressed={range === sectionIndex}
                  onClick={() => {
                    stop();
                    setChosen(null);
                    setArrow(-1);
                    setRange(range === sectionIndex ? "all" : sectionIndex);
                  }}
                >
                  {section.name}
                </button>
              </header>
              <ol className="chart">
                {sectionBars(guide, sectionIndex).map((bar, barIndex) => (
                  <li
                    key={barIndex}
                    className={bar.includes(now?.chord ?? -1) ? "is-now" : undefined}
                  >
                    {bar.length === 0
                      ? "·"
                      : bar.map((index) => guide.chords[index].chord).join(" ")}
                  </li>
                ))}
              </ol>
            </article>
          ),
        )}
      </section>
    </main>
  );
}
