import { useState } from "react";
import type { AttemptSummary } from "../domain/types";

const WIDTH = 640;
const HEIGHT = 268;
const PAD = { left: 42, right: 18, top: 16, bottom: 34 };
const DATE = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
const DATE_TIME = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

interface Placed {
  point: AttemptSummary;
  x: number;
  y: number;
}

function tone(accuracy: number): "good" | "mid" | "bad" {
  if (accuracy >= 80) {
    return "good";
  }
  if (accuracy >= 50) {
    return "mid";
  }
  return "bad";
}

function place(points: AttemptSummary[]): Placed[] {
  const ordered = [...points].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  return ordered.map((point, index) => {
    const accuracy = Math.min(100, Math.max(0, point.accuracy));
    const x =
      ordered.length === 1
        ? PAD.left + plotWidth / 2
        : PAD.left + (index / (ordered.length - 1)) * plotWidth;
    const y = PAD.top + ((100 - accuracy) / 100) * plotHeight;
    return { point, x, y };
  });
}

function lineOf(placed: Placed[]): string {
  return placed
    .map((item, index) => `${index === 0 ? "M" : "L"}${item.x.toFixed(1)} ${item.y.toFixed(1)}`)
    .join(" ");
}

function areaOf(placed: Placed[]): string {
  if (placed.length < 2) {
    return "";
  }
  const floor = HEIGHT - PAD.bottom;
  const first = placed[0];
  const last = placed[placed.length - 1];
  return `${lineOf(placed)} L${last.x.toFixed(1)} ${floor} L${first.x.toFixed(1)} ${floor} Z`;
}

function timing(deltaMs: number): string {
  const gap = Math.round(Math.abs(deltaMs));
  if (gap < 15) {
    return "a tiempo";
  }
  return deltaMs > 0 ? `${gap} ms tarde` : `${gap} ms pronto`;
}

function average(points: AttemptSummary[]): number {
  const total = points.reduce((sum, point) => sum + point.accuracy, 0);
  return total / points.length;
}

export function ProgressChart({
  points,
  activeId = null,
  onSelect,
}: {
  points: AttemptSummary[];
  activeId?: string | null;
  onSelect?: (attemptId: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) {
    return <p className="note">Todavía no hay intentos.</p>;
  }

  const placed = place(points);
  const last = placed[placed.length - 1].point;
  const previous = placed.length > 1 ? placed[placed.length - 2].point : null;
  const change = previous ? last.accuracy - previous.accuracy : null;
  const best = Math.max(...placed.map((item) => item.point.accuracy));
  const mean = average(placed.map((item) => item.point));
  const focused = hover === null ? null : placed[hover];
  const ticks = [0, 25, 50, 75, 100];
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const labelEvery = Math.max(1, Math.ceil(placed.length / 6));

  return (
    <div className="precision">
      <dl className="precision-stats">
        <div>
          <dt>Última</dt>
          <dd>{Math.round(last.accuracy)} %</dd>
        </div>
        <div>
          <dt>Media</dt>
          <dd>{Math.round(mean)} %</dd>
        </div>
        <div>
          <dt>Mejor</dt>
          <dd>{Math.round(best)} %</dd>
        </div>
        <div>
          <dt>Cambio</dt>
          <dd className={change === null ? undefined : change >= 0 ? "is-up" : "is-down"}>
            {change === null ? "—" : `${change > 0 ? "+" : ""}${Math.round(change)}`}
          </dd>
        </div>
      </dl>

      <div className="precision-chart">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Progreso de precisión">
          <title>Precisión de cada intento, del más antiguo al más reciente</title>
          <defs>
            <linearGradient id="precision-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.32" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((tick) => {
            const y = PAD.top + ((100 - tick) / 100) * plotHeight;
            return (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={WIDTH - PAD.right}
                  y1={y}
                  y2={y}
                  className="precision-grid"
                />
                <text x={PAD.left - 8} y={y + 4} className="precision-axis" textAnchor="end">
                  {tick}
                </text>
              </g>
            );
          })}
          {areaOf(placed) ? (
            <path d={areaOf(placed)} className="precision-area" fill="url(#precision-fill)" />
          ) : null}
          {placed.length > 1 ? <path d={lineOf(placed)} className="precision-line" /> : null}
          {placed.map((item, index) => {
            const chosen = item.point.id === activeId || index === hover;
            return (
              <g key={item.point.id}>
                <circle
                  cx={item.x}
                  cy={item.y}
                  r={chosen ? 7 : 5}
                  className={`precision-dot is-${tone(item.point.accuracy)}${chosen ? " is-chosen" : ""}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${item.point.songTitle ?? "Canción"}, ${Math.round(item.point.accuracy)} por ciento`}
                  onMouseEnter={() => setHover(index)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(index)}
                  onBlur={() => setHover(null)}
                  onClick={() => onSelect?.(item.point.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect?.(item.point.id);
                    }
                  }}
                />
                {index % labelEvery === 0 || index === placed.length - 1 ? (
                  <text x={item.x} y={HEIGHT - 10} className="precision-axis" textAnchor="middle">
                    {DATE.format(new Date(item.point.createdAt))}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {focused ? (
          <p
            className={[
              "precision-tip",
              focused.x > WIDTH * 0.62 ? "is-left" : "",
              focused.y < 72 ? "is-below" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ left: `${(focused.x / WIDTH) * 100}%`, top: `${(focused.y / HEIGHT) * 100}%` }}
          >
            <strong>{focused.point.songTitle ?? "Canción"}</strong>
            <span>{DATE_TIME.format(new Date(focused.point.createdAt))}</span>
            <span>
              {Math.round(focused.point.accuracy)} % · {timing(focused.point.avgDeltaMs)}
            </span>
          </p>
        ) : null}
      </div>

      <p className="precision-legend">
        <span className="is-good">80 % o más</span>
        <span className="is-mid">de 50 a 79</span>
        <span className="is-bad">menos de 50</span>
        {onSelect ? <span>Toca un punto para abrir su informe.</span> : null}
      </p>
    </div>
  );
}
