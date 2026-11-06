import type {
  GuideRecord,
  GuideStatus,
  GuideSummary,
  SongGuide,
  StrumEvent,
} from "../domain/guide";
import { ensureGrid } from "../domain/guide";

/** La guía en el formato de la API: el tempo viaja como us_per_quarter. */
export type WireGuide = Omit<SongGuide, "tempo" | "events"> & {
  tempo: Array<{ pulse: number; us_per_quarter: number }>;
  events: StrumEvent[];
};

/** La app trabaja el tempo en camelCase; la API lo valida en snake_case. */
export function guideToWire(guide: SongGuide): WireGuide {
  const grid = ensureGrid(guide);
  return {
    ...grid,
    tempo: grid.tempo!.map((point) => ({ pulse: point.pulse, us_per_quarter: point.usPerQuarter })),
    events: grid.events!,
  };
}

export interface GuideSummaryPayload {
  id: string;
  song_id: number | null;
  title: string;
  artist: string;
  bpm: number;
  source_kind: string;
  status: GuideStatus;
  updated_at: string;
}

export interface GuidePayload extends GuideSummaryPayload {
  guide: SongGuide;
}

export function guideSummaryFromPayload(body: GuideSummaryPayload): GuideSummary {
  return {
    id: body.id,
    songId: body.song_id,
    title: body.title,
    artist: body.artist,
    bpm: body.bpm,
    sourceKind: body.source_kind,
    status: body.status,
    updatedAt: body.updated_at,
  };
}

export function guideFromPayload(body: GuidePayload): GuideRecord {
  return { ...guideSummaryFromPayload(body), guide: body.guide };
}
