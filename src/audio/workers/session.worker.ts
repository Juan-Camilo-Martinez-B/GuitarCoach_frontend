import type { TelemetryEvent } from "../../domain/types";
import { judgeHit } from "../../game/ScoringEngine";

export interface TelemetryPayload {
  accuracy: number;
  avgDeltaMs: number;
  events: Array<{
    bar: number;
    expected: string;
    detected: string | null;
    delta_ms: number;
    confidence: number;
    kind: "hit" | "miss";
  }>;
}

export function buildTelemetry(events: TelemetryEvent[], windowMs = 150): TelemetryPayload {
  const judged = events.map((event) => ({
    bar: event.bar,
    expected: event.expected,
    detected: event.detected,
    delta_ms: event.deltaMs,
    confidence: event.confidence,
    kind: judgeHit(event.expected, event.detected, event.deltaMs, windowMs),
  }));
  const hits = judged.filter((event) => event.kind === "hit").length;
  const accuracy = events.length === 0 ? 0 : (hits / events.length) * 100;
  const avgDeltaMs =
    events.length === 0 ? 0 : events.reduce((sum, event) => sum + event.deltaMs, 0) / events.length;
  return { accuracy, avgDeltaMs, events: judged };
}
