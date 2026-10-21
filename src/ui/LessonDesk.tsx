import { useEffect, useState } from "react";
import { playMidi, playPattern, playStrum, warmNotes } from "../audio/guitarTone";
import { localShape, placeNote } from "../chords/shapes";
import { SONG_GUIDES, strumHits } from "../domain/course";
import { ChordFigure } from "./ChordDiagram";
import { SongLesson } from "./SongLesson";
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
    return <SongLesson bpm={guide.bpm} slots={guide.slots} />;
  }
  if (lessonId === "cuerdas") {
    return <StringBoard />;
  }
  if (lessonId === "trastes") {
    return <FretBoard />;
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

function FretBoard() {
  useEffect(() => {
    warmNotes(STRINGS.flatMap((string) => [0, 1, 2, 3].map((fret) => string.midi + fret)));
  }, []);
  return (
    <div className="fret-board" role="group" aria-label="Trastes desde la cejuela">
      {STRINGS.map((string) => (
        <div key={string.number} className="fret-row">
          <span>{string.number}</span>
          {[0, 1, 2, 3].map((fret) => (
            <button
              key={fret}
              type="button"
              className="fret-cell"
              onClick={() => playMidi(string.midi + fret)}
            >
              {fret === 0 ? "aire" : fret}
            </button>
          ))}
        </div>
      ))}
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

function StrumLesson() {
  const chord = localShape("Em");
  const [arrow, setArrow] = useState(-1);
  if (!chord) {
    return null;
  }
  return (
    <div className="song-lesson">
      <ChordFigure symbol="Em" />
      <StrumRail
        active={arrow}
        onStrum={(direction, index) => {
          setArrow(index);
          playStrum(chord, direction);
        }}
      />
      <button
        type="button"
        onClick={() => {
          playPattern(chord, 72);
          strumHits([4], 72).forEach((hit) => {
            window.setTimeout(() => setArrow(hit.hit), hit.at * 1000);
          });
        }}
      >
        Escuchar el rasgueo
      </button>
    </div>
  );
}
