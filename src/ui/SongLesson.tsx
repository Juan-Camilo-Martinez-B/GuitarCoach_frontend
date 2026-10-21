import { useEffect, useRef, useState } from "react";
import {
  playChord,
  playMidi,
  playPattern,
  playSlots,
  playStrum,
  stopGuitar,
  warmNotes,
  warmShape,
} from "../audio/guitarTone";
import { localShape, placeNote, shapeFor, type ChordShape } from "../chords/shapes";
import { type SongSlot } from "../domain/course";
import { ChordDiagram } from "./ChordDiagram";
import { StrumRail } from "./StrumRail";

export function SongLesson({ slots, bpm }: { slots: SongSlot[]; bpm: number }) {
  const [mode, setMode] = useState<"acordes" | "notas">("acordes");
  const [index, setIndex] = useState(0);
  const [arrow, setArrow] = useState(-1);
  const timers = useRef<number[]>([]);
  const chords = slots.map((slot) => slot.symbol);
  const notes = slots.map((slot) => slot.note);
  const [shapes, setShapes] = useState<Array<ChordShape | null>>(() =>
    chords.map((symbol) => localShape(symbol)),
  );
  const chordKey = chords.join("|");
  const noteKey = notes.join("|");
  const symbols = mode === "acordes" ? chords : notes;
  const current = symbols[index] ?? symbols[0];
  const shape = shapes[index] ?? null;
  const note = placeNote(current);

  useEffect(() => {
    const symbols = chordKey.split("|");
    let live = true;
    void Promise.all(symbols.map((symbol) => shapeFor(symbol))).then((next) => {
      if (live) {
        setShapes(next);
      }
    });
    return () => {
      live = false;
      timers.current.forEach((id) => window.clearTimeout(id));
      stopGuitar();
    };
  }, [chordKey]);

  useEffect(() => {
    for (const item of shapes) {
      if (item) {
        warmShape(item);
      }
    }
    warmNotes(
      noteKey.split("|").flatMap((symbol) => {
        const placed = placeNote(symbol);
        return placed ? [placed.midi] : [];
      }),
    );
  }, [shapes, noteKey]);

  function hearSong() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    if (mode === "notas") {
      stopGuitar();
      let beat = 0;
      slots.forEach((slot, step) => {
        const at = beat * (60 / bpm);
        const timer = window.setTimeout(() => {
          setIndex(step);
          const placed = placeNote(slot.note);
          if (placed) {
            playMidi(placed.midi);
          }
        }, at * 1000);
        timers.current.push(timer);
        beat += slot.beats;
      });
      return;
    }
    const hits = playSlots(
      shapes,
      slots.map((slot) => slot.beats),
      bpm,
    );
    for (const hit of hits) {
      const timer = window.setTimeout(() => {
        setIndex(hit.slot);
        setArrow(hit.hit);
      }, hit.at * 1000);
      timers.current.push(timer);
    }
  }

  return (
    <div className="song-lesson">
      <div className="auth-switch" role="tablist" aria-label="Manera de enseñar">
        <button type="button" aria-pressed={mode === "acordes"} onClick={() => setMode("acordes")}>
          Acordes y rasgueo
        </button>
        <button type="button" aria-pressed={mode === "notas"} onClick={() => setMode("notas")}>
          Notas del canto
        </button>
      </div>
      <ol className="phrase-row">
        {symbols.map((symbol, step) => (
          <li key={`${symbol}-${step}`}>
            <button
              type="button"
              className={step === index ? "is-current" : undefined}
              aria-pressed={step === index}
              onClick={() => setIndex(step)}
            >
              {step + 1}. {symbol}
              {mode === "notas" ? <small>cuerda {placeNote(symbol)?.string ?? "?"}</small> : null}
            </button>
          </li>
        ))}
      </ol>
      {mode === "acordes" && shape ? (
        <>
          <button type="button" className="chord-card" onClick={() => playChord(shape)}>
            <ChordDiagram chord={shape} />
            <span>Escuchar el acorde</span>
          </button>
          <StrumRail
            active={arrow}
            onStrum={(direction, strumIndex) => {
              setArrow(strumIndex);
              playStrum(shape, direction);
            }}
          />
          <p className="hint">El primer ↓ dura un tiempo. Los otros cinco duran medio tiempo.</p>
        </>
      ) : null}
      {mode === "notas" && note ? (
        <button type="button" className="note-key" onClick={() => playMidi(note.midi)}>
          <strong>{note.string}</strong>
          <span>
            Cuerda {note.string}
            {note.fret === 0 ? ", al aire" : `, traste ${note.fret}`}
          </span>
        </button>
      ) : null}
      <div className="actions">
        <button type="button" onClick={hearSong}>
          Escuchar la canción
        </button>
        <button
          type="button"
          className="button-ghost"
          onClick={() => {
            if (mode === "acordes" && shape) {
              setArrow(0);
              playPattern(shape, bpm);
            } else if (note) {
              playMidi(note.midi);
            }
          }}
        >
          {mode === "acordes" ? "Escuchar el rasgueo" : "Escuchar la nota"}
        </button>
      </div>
    </div>
  );
}
