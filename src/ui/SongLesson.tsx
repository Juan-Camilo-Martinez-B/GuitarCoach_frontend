import { useEffect, useRef, useState } from "react";
import {
  playChord,
  playPattern,
  playSlots,
  playStrum,
  stopGuitar,
  warmShape,
} from "../audio/guitarTone";
import { localShape, shapeFor, type ChordShape } from "../chords/shapes";
import { type SongSlot, type StrumPattern } from "../domain/course";
import { ChordDiagram } from "./ChordDiagram";
import { queueStrumMarks } from "./strumMarks";
import { StrumRail } from "./StrumRail";

export function SongLesson({
  slots,
  bpm,
  pattern,
}: {
  slots: SongSlot[];
  bpm: number;
  pattern: StrumPattern;
}) {
  const [index, setIndex] = useState(0);
  const [arrow, setArrow] = useState(-1);
  const timers = useRef<number[]>([]);
  const chords = slots.map((slot) => slot.symbol);
  const [shapes, setShapes] = useState<Array<ChordShape | null>>(() =>
    chords.map((symbol) => localShape(symbol)),
  );
  const chordKey = chords.join("|");
  const shape = shapes[index] ?? null;

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
  }, [shapes]);

  function hearSong() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    const hits = playSlots(
      shapes,
      slots.map((slot) => slot.beats),
      bpm,
      pattern,
    );
    timers.current = queueStrumMarks(
      hits,
      (hit) => {
        setIndex(hit.slot);
        setArrow(hit.hit);
      },
      () => setArrow(-1),
    );
  }

  return (
    <div className="song-lesson">
      <ol className="phrase-row">
        {chords.map((symbol, step) => (
          <li key={`${symbol}-${step}`}>
            <button
              type="button"
              className={step === index ? "is-current" : undefined}
              aria-pressed={step === index}
              onClick={() => setIndex(step)}
            >
              {step + 1}. {symbol}
            </button>
          </li>
        ))}
      </ol>
      {shape ? (
        <>
          <button type="button" className="chord-card" onClick={() => playChord(shape)}>
            <ChordDiagram chord={shape} />
            <span>Escuchar el acorde</span>
          </button>
          <StrumRail
            pattern={pattern}
            active={arrow}
            onStrum={(direction, strumIndex) => {
              setArrow(strumIndex);
              playStrum(shape, direction);
            }}
          />
          <p className="hint">{pattern.hint}</p>
        </>
      ) : null}
      <div className="actions">
        <button type="button" onClick={hearSong}>
          Escuchar la canción
        </button>
        <button
          type="button"
          className="button-ghost"
          onClick={() => {
            if (!shape) {
              return;
            }
            timers.current.forEach((id) => window.clearTimeout(id));
            timers.current = queueStrumMarks(
              playPattern(shape, bpm, pattern),
              (hit) => setArrow(hit.hit),
              () => setArrow(-1),
            );
          }}
        >
          Escuchar el rasgueo
        </button>
      </div>
    </div>
  );
}
