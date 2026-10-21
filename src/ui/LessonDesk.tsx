import { useEffect, useRef, useState } from "react";
import { playMidi, playPattern, playStrum, warmNotes } from "../audio/guitarTone";
import { localShape, placeNote } from "../chords/shapes";
import { SONG_GUIDES, STRUM_BASICO } from "../domain/course";
import { ChordFigure } from "./ChordDiagram";
import { FretNeck } from "./FretNeck";
import { SongLesson } from "./SongLesson";
import { queueStrumMarks } from "./strumMarks";
import { StrumRail } from "./StrumRail";

const STRINGS = [
  { number: 6, name: "Mi grave", midi: 40 },
  { number: 5, name: "La", midi: 45 },
  { number: 4, name: "Re", midi: 50 },
  { number: 3, name: "Sol", midi: 55 },
  { number: 2, name: "Si", midi: 59 },
  { number: 1, name: "Mi agudo", midi: 64 },
];

const OPEN_CHORDS = ["E", "A", "D", "G", "C", "Em", "Am", "D7", "A7", "F"];
const NOTES = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si"];

export function LessonDesk({ lessonId }: { lessonId: string }) {
  const guide = SONG_GUIDES[lessonId];
  if (guide) {
    return <SongLesson bpm={guide.bpm} slots={guide.slots} pattern={guide.pattern} />;
  }
  if (lessonId === "cuerdas") {
    return <StringBoard />;
  }
  if (lessonId === "trastes") {
    return <FretNeck />;
  }
  if (lessonId === "acorde") {
    return (
      <div className="chord-grid">
        <ChordFigure symbol="G" />
        <ChordFigure symbol="Em" />
      </div>
    );
  }
  if (lessonId === "notas") {
    return <NoteKeys />;
  }
  if (lessonId === "abiertos") {
    return (
      <div className="chord-grid">
        {OPEN_CHORDS.map((symbol) => (
          <ChordFigure key={symbol} symbol={symbol} />
        ))}
      </div>
    );
  }
  if (lessonId === "rasgueo") {
    return <StrumLesson />;
  }
  return null;
}

function StringBoard() {
  useEffect(() => {
    warmNotes(STRINGS.map((string) => string.midi));
  }, []);
  return (
    <div className="string-board">
      {STRINGS.map((string) => (
        <button
          key={string.number}
          type="button"
          className="string-row"
          onClick={() => playMidi(string.midi)}
        >
          <strong>{string.number}</strong>
          <span className="string-line" />
          <span>{string.name}</span>
        </button>
      ))}
    </div>
  );
}

function StrumLesson() {
  const chord = localShape("Em");
  const [arrow, setArrow] = useState(-1);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    return () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);
  if (!chord) {
    return null;
  }
  return (
    <div className="song-lesson">
      <ChordFigure symbol="Em" />
      <StrumRail
        pattern={STRUM_BASICO}
        active={arrow}
        onStrum={(direction, index) => {
          setArrow(index);
          playStrum(chord, direction);
        }}
      />
      <p className="hint">{STRUM_BASICO.hint}</p>
      <button
        type="button"
        onClick={() => {
          timers.current.forEach((id) => window.clearTimeout(id));
          timers.current = queueStrumMarks(
            playPattern(chord, 60, STRUM_BASICO),
            (hit) => setArrow(hit.hit),
            () => setArrow(-1),
          );
        }}
      >
        Escuchar el rasgueo
      </button>
    </div>
  );
}
function NoteKeys() {
  useEffect(() => {
    warmNotes(
      NOTES.flatMap((name) => {
        const placed = placeNote(name);
        return placed ? [placed.midi] : [];
      }),
    );
  }, []);
  return (
    <div className="note-row">
      {NOTES.map((name) => {
        const placed = placeNote(name);
        return (
          <button
            key={name}
            type="button"
            className="note-key"
            onClick={() => {
              if (placed) {
                playMidi(placed.midi);
              }
            }}
          >
            {name}
            {placed ? <small>cuerda {placed.string}</small> : null}
          </button>
        );
      })}
    </div>
  );
}
