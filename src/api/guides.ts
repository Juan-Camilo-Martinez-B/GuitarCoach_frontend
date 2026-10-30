import type { GuideRecord, GuideStatus, GuideSummary, SongGuide } from "../domain/guide";

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
