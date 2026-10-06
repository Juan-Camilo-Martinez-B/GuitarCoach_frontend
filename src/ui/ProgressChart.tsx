import type { AttemptSummary } from "../domain/types";

export function ProgressChart({ points }: { points: AttemptSummary[] }) {
  if (points.length === 0) {
    return <p className="note">Todavía no hay intentos.</p>;
  }
  const coordinates = points
    .map((point, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 100 - point.accuracy;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg className="progress" viewBox="0 0 100 100" role="img" aria-label="Progreso de precisión">
      <polyline points={coordinates} fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}
