import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AudioEngine, tunerStatusLabel, type EngineState } from "../audio/engine/AudioEngine";
import { playMidi, warmNotes } from "../audio/guitarTone";
import { needleX } from "../audio/tuner/channel";
import { GUITAR_MIC, startPitchMonitor } from "../audio/tuner/listen";
import {
  GUITAR_STRINGS,
  nearestString,
  readingMidi,
  tuningAdvice,
  type GuitarString,
} from "../audio/tuner/strings";
import { useJourney } from "../store/journey";
import { Icon } from "../ui/Icon";
import { PageHeader } from "../ui/PageHeader";
import { Term } from "../ui/Term";

const GAUGE_WIDTH = 640;

interface Target {
  string: GuitarString;
  cents: number;
}

/** La aguja va al centro cuando la cuerda está afinada: no hace falta saber leer los números. */
function TuningGauge({ cents }: { cents: number | null }) {
  return (
    <svg className="gauge" viewBox={`0 0 ${GAUGE_WIDTH} 112`} aria-hidden="true">
      <rect className="gauge-off" x="0" y="26" width="208" height="52" rx="14" />
      <rect className="gauge-near" x="208" y="26" width="84" height="52" />
      <rect className="gauge-near" x="348" y="26" width="84" height="52" />
      <rect className="gauge-off" x="432" y="26" width="208" height="52" rx="14" />
      <rect className="gauge-good" x="292" y="20" width="56" height="64" rx="10" />
      <text className="gauge-label" x="4" y="106">
        Muy grave
      </text>
      <text className="gauge-label" x={GAUGE_WIDTH / 2} y="106" textAnchor="middle">
        Afinada
      </text>
      <text className="gauge-label" x={GAUGE_WIDTH - 4} y="106" textAnchor="end">
        Muy aguda
      </text>
      {cents === null ? null : (
        <g
          className="gauge-needle"
          style={{ transform: `translateX(${needleX(cents, GAUGE_WIDTH)}px)` }}
        >
          <line x1="0" y1="14" x2="0" y2="88" />
          <circle cx="0" cy="10" r="7" />
        </g>
      )}
    </svg>
  );
}

export function TunerPage() {
  const stopRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<EngineState>("idle");
  const [target, setTarget] = useState<Target | null>(null);
  const [tuned, setTuned] = useState<ReadonlySet<number>>(new Set());
  const record = useJourney((journey) => journey.record);

  useEffect(() => {
    warmNotes(GUITAR_STRINGS.map((string) => string.midi));
    return () => {
      stopRef.current?.();
    };
  }, []);

  function show(next: Target | null) {
    setTarget(next);
    if (next && tuningAdvice(next.cents).kind === "afinada") {
      setTuned((current) =>
        current.has(next.string.number) ? current : new Set(current).add(next.string.number),
      );
      record("afinar");
    }
  }

  async function activate() {
    stopRef.current?.();
    stopRef.current = null;
    show(null);
    const engine = new AudioEngine({
      request: async () => {
        const stream = await navigator.mediaDevices.getUserMedia(GUITAR_MIC);
        if (!(stream instanceof MediaStream)) {
          return;
        }
        stopRef.current = await startPitchMonitor(stream, (reading) => {
          show(reading ? nearestString(readingMidi(reading)) : null);
        });
      },
    });
    await engine.start();
    setState(engine.state);
    if (engine.state === "listening") {
      record();
    }
  }

  function deactivate() {
    stopRef.current?.();
    stopRef.current = null;
    show(null);
    setState("idle");
  }

  const advice = target ? tuningAdvice(target.cents) : null;
  const listening = state === "listening";

  return (
    <main className="page">
      <PageHeader icon="tuner" eyebrow="Paso 1: suena bien desde el inicio" title="Afinador">
        Afinar es ajustar cada cuerda a su nota. Gira la <Term id="clavija">clavija</Term> hasta que
        la aguja quede en el centro verde.
      </PageHeader>

      <ol className="steps-strip">
        <li>Activa el micrófono</li>
        <li>
          <span>
            Toca una cuerda <Term id="al-aire">al aire</Term>
          </span>
        </li>
        <li>Gira la clavija poco a poco</li>
      </ol>

      <div className="tuner-layout">
        <section
          className={advice ? `panel meter is-${advice.kind}` : "panel meter"}
          aria-label="Tablero del afinador"
        >
          <p className={target ? "note-readout" : "note-readout is-idle"}>
            {target ? `Cuerda ${target.string.number}` : "A la espera"}
          </p>
          <TuningGauge cents={target?.cents ?? null} />
          <p className="cents-readout" role="status">
            {target && advice
              ? `${target.string.name} · ${advice.text}`
              : listening
                ? "Toca una cuerda"
                : "Activa el micrófono para empezar"}
          </p>
          <div className="actions">
            {listening ? (
              <button type="button" className="button-large is-listening" onClick={deactivate}>
                <Icon name="stop" />
                Apagar micrófono
              </button>
            ) : (
              <button type="button" className="button-large" onClick={() => void activate()}>
                <Icon name="mic" />
                Activar micrófono
              </button>
            )}
            <p className="status-pill">{tunerStatusLabel(state)}</p>
          </div>
          {state === "denied" ? (
            <p className="hint">
              Permite el micrófono desde el candado de la barra de direcciones y vuelve a activarlo.
            </p>
          ) : (
            <p className="hint">Nada del micrófono sale de tu navegador.</p>
          )}
        </section>

        <section className="panel">
          <h2>¿Sin micrófono? Afina de oído</h2>
          <p className="hint">
            Pulsa una cuerda, escúchala y ajusta la tuya hasta que suene igual.
          </p>
          <div className="reference-strings" role="group" aria-label="Cuerdas al aire">
            {GUITAR_STRINGS.map((string) => (
              <button
                key={string.number}
                type="button"
                className={tuned.has(string.number) ? "is-tuned" : undefined}
                aria-pressed={target?.string.number === string.number}
                onClick={() => {
                  playMidi(string.midi);
                  record();
                }}
              >
                <strong>{string.number}</strong>
                <span>{string.name}</span>
                {tuned.has(string.number) ? (
                  <>
                    <Icon name="check" size={18} />
                    <span className="visually-hidden">Afinada</span>
                  </>
                ) : (
                  <Icon name="sound" size={18} />
                )}
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="actions actions-split">
        <p className="hint">¿Ya suena bien? Sigue con una canción fácil.</p>
        <Link className="button" to="/biblioteca" onClick={() => record("afinar")}>
          Ya afiné, elegir canción
          <Icon name="arrowRight" size={18} />
        </Link>
      </div>
    </main>
  );
}
