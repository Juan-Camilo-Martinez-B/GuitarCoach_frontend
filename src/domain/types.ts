export interface ChartChord {
  bar: number;
  beat: number;
  chord: string;
}

export interface StudyStep {
  bar: number;
  beat: number;
  symbol: string;
  label: string;
  detail: string;
}

export interface SongStudy {
  summary: string;
  difficulty: string;
  chords: StudyStep[];
  melody: StudyStep[];
}

export interface LessonView {
  id: string;
  title: string;
  summary: string;
  points: string[];
  songTitle: string | null;
  status: "completed" | "pending";
  locked: boolean;
}

export interface Curriculum {
  needsReview: boolean;
  review: Array<{ title: string; points: string[] }>;
  lessons: LessonView[];
}

export interface CoachPlan {
  diagnostico: string;
  ejercicios: string[];
  planSemanal: string[];
  consejosTecnica: string[];
  model: string;
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
  songTitle: string | null;
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
