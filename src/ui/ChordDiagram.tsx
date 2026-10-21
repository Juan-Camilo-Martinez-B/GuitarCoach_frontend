import { useEffect, useState } from "react";
import { playChord, warmShape } from "../audio/guitarTone";
import { localShape, shapeFor, spanishName, type ChordShape } from "../chords/shapes";

const GAP = 18;
const FRET = 26;
const LEFT = 34;
const TOP = 42;

export function ChordDiagram({ chord }: { chord: ChordShape }) {
  const used = chord.frets.filter((fret) => fret > 0);
  const start = used.length === 0 || Math.max(...used) <= 4 ? 1 : Math.min(...used);
  const count = start === 1 ? 5 : 4;
  const width = LEFT + GAP * 5 + 22;
  const height = TOP + FRET * count + 16;

  return (
    <svg className="chord-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
      <text x={width / 2} y={16} textAnchor="middle" className="chord-title">
        {spanishName(chord.name)}
      </text>
      {chord.frets.map((fret, index) => {
        const x = LEFT + index * GAP;
        if (fret < 0) {
          return (
            <text key={index} x={x} y={32} textAnchor="middle" className="chord-mark">
              ×
            </text>
          );
        }
        if (fret === 0) {
          return <circle key={index} cx={x} cy={30} r={6} className="chord-open" />;
        }
        return null;
      })}
      {start === 1 ? (
        <line x1={LEFT} x2={LEFT + GAP * 5} y1={TOP} y2={TOP} className="chord-nut" />
      ) : (
        <text x={8} y={TOP + FRET * 0.72} className="chord-fret-no">
          {start}
        </text>
      )}
      {Array.from({ length: count + 1 }, (_, line) => (
        <line
          key={line}
          x1={LEFT}
          x2={LEFT + GAP * 5}
          y1={TOP + line * FRET}
          y2={TOP + line * FRET}
          className="chord-fret"
        />
      ))}
      {Array.from({ length: 6 }, (_, index) => (
        <line
          key={index}
          x1={LEFT + index * GAP}
          x2={LEFT + index * GAP}
          y1={TOP}
          y2={TOP + count * FRET}
          className="chord-string"
        />
      ))}
      {[3, 5, 7, 9, 12]
        .filter((fret) => fret >= start && fret < start + count)
        .map((fret) => (
          <text key={fret} x={14} y={TOP + (fret - start + 0.72) * FRET} className="chord-fret-no">
            {fret}
          </text>
        ))}
      {chord.barre ? (
        <rect
          x={LEFT - 8}
          y={TOP + (chord.barre - start + 0.5) * FRET - 7}
          width={GAP * 5 + 16}
          height={14}
          rx={7}
          className="chord-barre"
        />
      ) : null}
      {chord.frets.map((fret, index) => {
        if (fret <= 0 || fret === chord.barre) {
          return null;
        }
        const finger = chord.fingers[index] ?? 0;
        const cx = LEFT + index * GAP;
        const cy = TOP + (fret - start + 0.5) * FRET;
        return (
          <g key={index}>
            <circle cx={cx} cy={cy} r={8} className="chord-dot" />
            {finger > 0 ? (
              <text
                x={cx}
                y={cy + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                className="chord-finger"
              >
                {finger}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function ChordFigure({ symbol }: { symbol: string }) {
  const [chord, setChord] = useState<ChordShape | null>(() => localShape(symbol));
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (chord) {
      warmShape(chord);
    }
  }, [chord]);

  useEffect(() => {
    const known = localShape(symbol);
    setChord(known);
    setMissing(false);
    if (known) {
      return;
    }
    let live = true;
    void shapeFor(symbol).then((next) => {
      if (!live) {
        return;
      }
      setChord(next);
      setMissing(next === null);
    });
    return () => {
      live = false;
    };
  }, [symbol]);

  if (!chord) {
    return (
      <p className="hint">{missing ? `Sin diagrama para ${symbol}.` : "Buscando el diagrama…"}</p>
    );
  }

  return (
    <button
      type="button"
      className="chord-card"
      onClick={() => playChord(chord)}
      aria-label={`Escuchar ${spanishName(symbol)}`}
    >
      <ChordDiagram chord={chord} />
      <span>{symbol}</span>
    </button>
  );
}
