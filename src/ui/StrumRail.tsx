import type { StrumPattern } from "../domain/course";

export function StrumRail({
  active,
  pattern,
  onStrum,
}: {
  active: number;
  pattern: StrumPattern;
  onStrum: (direction: StrumPattern["directions"][number], index: number) => void;
}) {
  return (
    <div className="strum-rail" role="group" aria-label="Rasgueo abajo y arriba">
      {pattern.directions.map((direction, index) => (
        <button
          key={`${direction}-${index}`}
          type="button"
          className={index === active ? "strum-arrow is-on" : "strum-arrow"}
          aria-pressed={index === active}
          onClick={() => onStrum(direction, index)}
        >
          <span aria-hidden="true">{direction === "abajo" ? "↓" : "↑"}</span>
          <small>{direction}</small>
        </button>
      ))}
    </div>
  );
}
