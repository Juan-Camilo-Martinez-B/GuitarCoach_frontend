import type { StrumDirection, StrumPattern } from "../domain/course";

export const STRUM_GLYPH: Record<StrumDirection, string> = {
  abajo: "↓",
  arriba: "↑",
  apagado: "×",
};

export function StrumRail({
  active,
  pattern,
  onStrum,
  marks = [],
}: {
  active: number;
  pattern: StrumPattern;
  onStrum: (direction: StrumDirection, index: number) => void;
  /** Nombre del acorde cuando este golpe lo cambia. */
  marks?: ReadonlyArray<string | null>;
}) {
  return (
    <div className="strum-rail" role="group" aria-label="Rasgueo abajo y arriba">
      {pattern.directions.map((direction, index) => {
        const mark = marks[index] ?? null;
        const classes = ["strum-arrow"];
        if (index === active) {
          classes.push("is-on");
        }
        if (mark) {
          classes.push("is-change");
        }
        return (
          <button
            key={`${direction}-${index}`}
            type="button"
            className={classes.join(" ")}
            aria-pressed={index === active}
            onClick={() => onStrum(direction, index)}
          >
            {mark ? <em className="strum-change">{mark}</em> : null}
            <span aria-hidden="true">{STRUM_GLYPH[direction]}</span>
            <small>{direction}</small>
          </button>
        );
      })}
    </div>
  );
}
