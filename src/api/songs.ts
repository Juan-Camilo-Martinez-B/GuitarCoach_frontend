import type { ChartChord, Song } from "../domain/types";

export interface SongPayload {
  id: number;
  title: string;
  artist: string;
  song_key?: string | null;
  bpm: number;
  chords: ChartChord[];
}

export function songFromPayload(body: SongPayload): Song {
  return {
    id: body.id,
    title: body.title,
    artist: body.artist,
    songKey: body.song_key ?? "",
    bpm: body.bpm,
    chords: body.chords,
  };
}

export interface JobSnapshot {
  status: string;
}

export async function pollJob(
  read: () => Promise<JobSnapshot>,
  wait: (ms: number) => Promise<void>,
  attempts = 5,
): Promise<string> {
  let status = "pending";
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    status = (await read()).status;
    if (status === "done" || status === "failed") {
      return status;
    }
    await wait(0);
  }
  return status;
}
