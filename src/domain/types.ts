export interface ChartChord {
  bar: number;
  beat: number;
  chord: string;
}

export interface Song {
  id: number;
  title: string;
  artist: string;
  songKey: string;
  bpm: number;
  chords: ChartChord[];
}

export interface TelemetryEvent {
  bar: number;
  expected: string;
  detected: string | null;
  deltaMs: number;
  confidence: number;
}

export interface AttemptSummary {
  id: string;
  songId: number;
  accuracy: number;
  avgDeltaMs: number;
  createdAt: string;
}

export interface ReportView {
  id: string;
  attemptId: string;
  diagnostico: string;
  ejercicios: string[];
  planSemanal: string[];
  consejosTecnica: string[];
  model: string;
}
