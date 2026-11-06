import { useEffect, useState, type CSSProperties } from "react";
import { playChord, playMidi, warmNotes, warmShape } from "../audio/guitarTone";
import { GUITAR_STRINGS } from "../audio/tuner/strings";
import { localShape, spanishName } from "../chords/shapes";

const FRETS = [1, 2, 3, 4, 5, 6, 7];
const DOTTED = new Set([3, 5, 7]);
const STARTER_CHORDS = ["Em", "G", "C", "D"];
const NOTE_NAMES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];

export function noteName(midi: number): string {
  return NOTE_NAMES[midi % 12];
}

interface Spot {
  string: number;
  fret: number;
}

function describe(spot: Spot, midi: number): string {
  return spot.fret === 0
    ? `Cuerda ${spot.string} al aire: sin pisar, suena ${noteName(midi)}.`
    : `Cuerda ${spot.string}, traste ${spot.fret}: al pisar aquí, suena ${noteName(midi)}.`;
}

/** Un mástil para tocar con el dedo: cada casilla suena y explica lo que acabas de hacer. */
export function GuitarExplorer() {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [chord, setChord] = useState<string | null>(null);
  const shape = chord ? localShape(chord) : null;

  useEffect(() => {
    warmNotes(GUITAR_STRINGS.map((string) => string.midi));
    for (const symbol of STARTER_CHORDS) {
      const starter = localShape(symbol);
      if (starter) {
        warmShape(starter);
      }
    }
  }, []);

  function pluck(string: number, fret: number, midi: number) {
    setChord(null);
    setSpot({ string, fret });
    playMidi(midi);
  }

  function strum(symbol: string) {
    const next = localShape(symbol);
    setSpot(null);
    setChord(symbol);
    if (next) {
      playChord(next);
    }
  }

  const picked = spot ? GUITAR_STRINGS.find((item) => item.number === spot.string) : null;
  const caption =
    spot && picked
      ? describe(spot, picked.midi + spot.fret)
      : chord
        ? `${spanishName(chord)}: pon los dedos en los puntos numerados. Las cuerdas con × no se tocan.`
        : "Toca cualquier casilla del mástil o elige un acorde para oírlo.";

  return (
    <div className="explorer">
      <div className="explorer-board" role="group" aria-label="Mástil de guitarra interactivo">
        <div className="explorer-frets" aria-hidden="true">
          <span>Aire</span>
          {FRETS.map((fret) => (
            <span key={fret} className={DOTTED.has(fret) ? "is-dotted" : undefined}>
              {fret}
            </span>
          ))}
        </div>
        {GUITAR_STRINGS.map((string, row) => {
          const pressed = shape?.frets[row];
          return (
            <div
              key={string.number}
              className="explorer-string"
              style={{ "--gauge": `${3.4 - row * 0.45}px` } as CSSProperties}
            >
              {[0, ...FRETS].map((fret) => {
                const midi = string.midi + fret;
                const on = spot?.string === string.number && spot.fret === fret;
                const inChord = pressed === fret;
                const classes = ["explorer-cell"];
                if (fret === 0) {
                  classes.push("is-open");
                }
                if (on || inChord) {
                  classes.push("is-on");
                }
                return (
                  <button
                    key={fret}
                    type="button"
                    className={classes.join(" ")}
                    aria-label={`Cuerda ${string.number}, ${fret === 0 ? "al aire" : `traste ${fret}`}: ${noteName(midi)}`}
                    onClick={() => pluck(string.number, fret, midi)}
                  >
                    {fret === 0 ? (
                      <span className="explorer-open">{pressed === -1 ? "×" : string.number}</span>
                    ) : null}
                    {fret > 0 && (on || inChord) ? (
                      <span className="explorer-dot">
                        {on ? noteName(midi) : shape?.fingers[row] || ""}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="explorer-caption" role="status">
        {caption}
      </p>
      <div className="explorer-chords" role="group" aria-label="Probar un acorde">
        {STARTER_CHORDS.map((symbol) => (
          <button
            key={symbol}
            type="button"
            className="chip-button"
            aria-pressed={chord === symbol}
            onClick={() => strum(symbol)}
          >
            {spanishName(symbol)}
          </button>
        ))}
      </div>
    </div>
  );
}
