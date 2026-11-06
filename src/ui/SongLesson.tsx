import { useEffect, useRef, useState } from "react";
import {
  playChord,
  playMelody,
  playPattern,
  playSlots,
  playStrum,
  stopGuitar,
  warmShape,
} from "../audio/guitarTone";
import { noteLabel } from "../audio/listening/scoreFollower";
import { localShape, shapeFor, type ChordShape } from "../chords/shapes";
import { type SongSlot, type StrumHit, type StrumPattern } from "../domain/course";
import type { GuideNote } from "../domain/guide";
import { ChordDiagram } from "./ChordDiagram";
import { queueStrumMarks } from "./strumMarks";
import { StrumRail } from "./StrumRail";

const BEATS_PER_BAR = 4;

function barOf(note: GuideNote | undefined): number {
  return Math.floor((note?.start ?? 0) / BEATS_PER_BAR);
}

export function SongLesson({
  slots,
  bpm,
  pattern,
  melody = [],
}: {
  slots: SongSlot[];
  bpm: number;
  pattern: StrumPattern;
  melody?: readonly GuideNote[];
}) {
  const [index, setIndex] = useState(0);
  const [arrow, setArrow] = useState(-1);
  const [melodyNote, setMelodyNote] = useState(0);
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

  function follow(hits: StrumHit[], mark: (hit: StrumHit) => void) {
    // Sin golpes significa que otra reproducción reemplazó a esta.
    if (hits.length === 0) {
      return;
    }
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = queueStrumMarks(hits, mark, () => setArrow(-1));
  }

  function hearSong() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    void playSlots(
      shapes,
      slots.map((slot) => slot.beats),
      bpm,
      pattern,
    ).then((hits) =>
      follow(hits, (hit) => {
        setIndex(hit.slot);
        setArrow(hit.hit);
      }),
    );
  }

  function hearMelody() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setMelodyNote(0);
    void playMelody(melody, bpm).then((delay) => {
      // Sin demora significa que otra reproducción reemplazó a esta.
      if (delay === null) {
        return;
      }
      const secondsPerBeat = 60 / bpm;
      timers.current = melody.map((note, position) =>
        window.setTimeout(
          () => setMelodyNote(position),
          (delay + note.start * secondsPerBeat) * 1000,
        ),
      );
    });
  }

  const melodyBar = barOf(melody[melodyNote]);

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
      {melody.length > 0 ? (
        <section aria-label="Melodía">
          <p className="hint">
            Melodía: compás {melodyBar + 1} de {barOf(melody.at(-1)) + 1}
          </p>
          <ol className="note-track">
            {melody.map((note, position) =>
              barOf(note) === melodyBar ? (
                <li
                  key={note.start}
                  className={position === melodyNote ? "note-chip is-now" : "note-chip"}
                >
                  {noteLabel(note.midi)}
                </li>
              ) : null,
            )}
          </ol>
        </section>
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
            void playPattern(shape, bpm, pattern).then((hits) =>
              follow(hits, (hit) => setArrow(hit.hit)),
            );
          }}
        >
          Escuchar el rasgueo
        </button>
        {melody.length > 0 ? (
          <button type="button" className="button-ghost" onClick={hearMelody}>
            Escuchar la melodía
          </button>
        ) : null}
      </div>
    </div>
  );
}
