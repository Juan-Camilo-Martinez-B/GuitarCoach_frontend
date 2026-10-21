import { useEffect, useState } from "react";
import { playMidi, warmNotes } from "../audio/guitarTone";

const NUT = 188;
const BOARD_X = 221;
const BOARD_W = 56;
const WIRES = [
  236, 280, 321, 361, 399, 435, 469, 501, 532, 560, 586, 611, 633, 653, 671, 687, 700, 711, 720,
];
const LAST = WIRES.length;
const FRETS = Array.from({ length: LAST }, (_, index) => index + 1);
const MARKS = [3, 5, 7, 9, 12, 19];

function span(fret: number) {
  const top = fret === 1 ? NUT : WIRES[fret - 2];
  const bottom = WIRES[fret - 1];
  return { top, bottom, mid: (top + bottom) / 2 };
}

export function FretNeck() {
  const [chosen, setChosen] = useState(1);
  const first = span(1);

  useEffect(() => {
    warmNotes(FRETS.map((fret) => 64 + fret));
  }, []);

  function playFret(fret: number) {
    setChosen(fret);
    playMidi(64 + fret);
  }

  return (
    <figure className="fret-neck">
      <div className="fret-photo">
        <img src="/guitar/dreadnought.svg" alt="" />
        <svg viewBox="0 0 500 1233" aria-labelledby="fret-title fret-desc">
          <title id="fret-title">Guitarra con los trastes del 1 al {LAST}</title>
          <desc id="fret-desc">
            Un traste es el espacio entre dos metales. Se cuentan desde la cejuela hasta el último,
            junto al cuerpo.
          </desc>
          <line className="fret-halo" x1="292" y1={NUT - 16} x2="214" y2={NUT} />
          <line className="fret-brass" x1="292" y1={NUT - 16} x2="214" y2={NUT} />
          <text className="fret-ink" x="300" y={NUT - 18} fontSize="20">
            cejuela
          </text>
          <line className="fret-halo" x1="286" y1={first.top + 4} x2="286" y2={first.bottom - 4} />
          <line className="fret-brass" x1="286" y1={first.top + 4} x2="286" y2={first.bottom - 4} />
          <line className="fret-brass" x1="286" y1={first.top + 4} x2="296" y2={first.top + 4} />
          <line
            className="fret-brass"
            x1="286"
            y1={first.bottom - 4}
            x2="296"
            y2={first.bottom - 4}
          />
          <text className="fret-ink" x="304" y={first.mid + 6} fontSize="20">
            1, un traste
          </text>
          {FRETS.map((fret) => {
            const { top, bottom } = span(fret);
            return (
              <rect
                key={fret}
                x={BOARD_X}
                y={top}
                width={BOARD_W}
                height={Math.max(4, bottom - top)}
                role="button"
                tabIndex={0}
                aria-label={`Traste ${fret}${fret === LAST ? ", el último" : ""}`}
                aria-pressed={chosen === fret}
                onClick={() => playFret(fret)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    playFret(fret);
                  }
                }}
              />
            );
          })}
          {MARKS.map((fret) => {
            const { mid } = span(fret);
            const x = fret === LAST ? 372 : 304;
            return (
              <text key={fret} className="fret-ink" x={x} y={mid + 6} fontSize="20">
                {fret}
              </text>
            );
          })}
        </svg>
      </div>
      <figcaption>Dibujo de narrowhouse, dominio público (CC0), Open Clip Art.</figcaption>
      <p className="hint">
        Un traste es el espacio entre dos metales. El 1 está junto a la cejuela y el {LAST} es el
        último, junto al cuerpo. El dedo pisa justo detrás del metal. Ahora suena el traste {chosen}{" "}
        en la cuerda 1.
      </p>
    </figure>
  );
}
