import type {
  AttemptSummary,
  CoachPlan,
  Curriculum,
  ReportView,
  Song,
  SongStudy,
} from "../domain/types";
import type { GuideRecord, GuideStatus, GuideSummary, SongGuide } from "../domain/guide";
import {
  guideFromPayload,
  guideSummaryFromPayload,
  type GuidePayload,
  type GuideSummaryPayload,
} from "./guides";
import { songFromPayload, type SongPayload } from "./songs";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type FetchLike = typeof fetch;

export class ApiClient {
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly baseUrl: string,
    fetchImpl: FetchLike = fetch,
    private token: string | null = null,
  ) {
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  setToken(token: string | null): void {
    this.token = token;
  }

  async health(): Promise<boolean> {
    const response = await this.fetchImpl(this.url("/health"));
    if (!response.ok) {
      return false;
    }
    const body = (await response.json()) as { status?: string };
    return body.status === "ok";
  }

  async register(email: string, password: string, displayName: string): Promise<void> {
    await this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name: displayName }),
    });
  }

  async login(email: string, password: string): Promise<string> {
    const response = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const body = (await response.json()) as { access_token: string };
    this.token = body.access_token;
    return body.access_token;
  }

  async searchSongs(query: string): Promise<Song[]> {
    const response = await this.request(`/songs?q=${encodeURIComponent(query)}`);
    const body = (await response.json()) as SongPayload[];
    return body.map(songFromPayload);
  }

  async importSong(query: string): Promise<{ id: string; status: string }> {
    const response = await this.request("/songs/import", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
    return (await response.json()) as { id: string; status: string };
  }

  async job(id: string): Promise<{ id: string; status: string; song_id: number | null }> {
    const response = await this.request(`/jobs/${id}`);
    return (await response.json()) as { id: string; status: string; song_id: number | null };
  }

  async createReport(attemptId: string): Promise<ReportView> {
    const response = await this.request(`/attempts/${attemptId}/report`, { method: "POST" });
    const body = (await response.json()) as {
      id: string;
      attempt_id: string;
      diagnostico: string;
      ejercicios: string[];
      plan_semanal: string[];
      consejos_tecnica: string[];
      model: string;
    };
    return {
      id: body.id,
      attemptId: body.attempt_id,
      diagnostico: body.diagnostico,
      ejercicios: body.ejercicios,
      planSemanal: body.plan_semanal,
      consejosTecnica: body.consejos_tecnica,
      model: body.model,
    };
  }

  async createAttempt(
    songId: number,
    bpm: number,
    events: Array<{
      bar: number;
      expected: string;
      detected: string | null;
      deltaMs: number;
      confidence: number;
    }>,
  ): Promise<{ id: string; accuracy: number }> {
    const response = await this.request("/attempts", {
      method: "POST",
      body: JSON.stringify({
        song_id: songId,
        bpm,
        latency_offset_ms: 0,
        events: events.map((event) => ({
          bar: event.bar,
          expected: event.expected,
          detected: event.detected,
          delta_ms: event.deltaMs,
          confidence: event.confidence,
        })),
      }),
    });
    const body = (await response.json()) as { id: string; accuracy: number };
    return { id: body.id, accuracy: body.accuracy };
  }

  async curriculum(): Promise<Curriculum> {
    const response = await this.request("/me/curriculum");
    const body = (await response.json()) as {
      needs_review: boolean;
      review: Array<{ title: string; points: string[] }>;
      lessons: Array<{
        id: string;
        title: string;
        summary: string;
        points: string[];
        song_title: string | null;
        status: "completed" | "pending";
        locked: boolean;
      }>;
    };
    return {
      needsReview: body.needs_review,
      review: body.review,
      lessons: body.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        summary: lesson.summary,
        points: lesson.points,
        songTitle: lesson.song_title,
        status: lesson.status,
        locked: lesson.locked,
      })),
    };
  }

  async completeLesson(lessonId: string): Promise<void> {
    await this.request(`/me/lessons/${lessonId}/complete`, { method: "POST" });
  }

  async acknowledgeReview(): Promise<void> {
    await this.request("/me/review", { method: "POST" });
  }

  async coach(mode: "quiz" | "progresion"): Promise<CoachPlan> {
    const response = await this.request("/me/coach", {
      method: "POST",
      body: JSON.stringify({ mode }),
    });
    const body = (await response.json()) as {
      diagnostico: string;
      ejercicios: string[];
      plan_semanal: string[];
      consejos_tecnica: string[];
      model: string;
    };
    return {
      diagnostico: body.diagnostico,
      ejercicios: body.ejercicios,
      planSemanal: body.plan_semanal,
      consejosTecnica: body.consejos_tecnica,
      model: body.model,
    };
  }

  async songStudy(songId: number): Promise<SongStudy> {
    const response = await this.request(`/songs/${songId}/study`);
    return (await response.json()) as SongStudy;
  }

  async progress(): Promise<AttemptSummary[]> {
    const response = await this.request("/me/progress");
    const body = (await response.json()) as Array<{
      attempt_id: string;
      song_id: number;
      accuracy: number;
      avg_delta_ms: number;
      created_at: string;
    }>;
    return body.map((point) => ({
      id: point.attempt_id,
      songId: point.song_id,
      accuracy: point.accuracy,
      avgDeltaMs: point.avg_delta_ms,
      createdAt: point.created_at,
    }));
  }

  async pasteGuide(input: {
    title: string;
    artist: string;
    text: string;
    bpm?: number;
    time?: string;
    capo?: number;
    strum?: string;
  }): Promise<GuideRecord> {
    const response = await this.request("/guides/paste", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return guideFromPayload((await response.json()) as GuidePayload);
  }

  async uploadGuide(file: File): Promise<GuideRecord> {
    const headers = new Headers();
    if (this.token) {
      headers.set("Authorization", `Bearer ${this.token}`);
    }
    const body = new FormData();
    body.append("file", file);
    const response = await this.fetchImpl(this.url("/guides/upload"), {
      method: "POST",
      headers,
      body,
    });
    if (!response.ok) {
      throw await this.readError(response);
    }
    return guideFromPayload((await response.json()) as GuidePayload);
  }

  async listGuides(): Promise<GuideSummary[]> {
    const response = await this.request("/guides");
    const body = (await response.json()) as GuideSummaryPayload[];
    return body.map(guideSummaryFromPayload);
  }

  async guide(id: string): Promise<GuideRecord> {
    const response = await this.request(`/guides/${encodeURIComponent(id)}`);
    return guideFromPayload((await response.json()) as GuidePayload);
  }

  async updateGuide(id: string, guide: SongGuide, status: GuideStatus): Promise<GuideRecord> {
    const response = await this.request(`/guides/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ status, guide }),
    });
    return guideFromPayload((await response.json()) as GuidePayload);
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (this.token) {
      headers.set("Authorization", `Bearer ${this.token}`);
    }
    const response = await this.fetchImpl(this.url(path), { ...init, headers });
    if (!response.ok) {
      throw await this.readError(response);
    }
    return response;
  }

  private async readError(response: Response): Promise<ApiError> {
    const raw = await response.text();
    let message = `La API respondió ${response.status}.`;
    try {
      const body = JSON.parse(raw) as { message?: string; detail?: Array<{ msg?: string }> };
      if (body.message) {
        message = body.message;
      } else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
        // Validación de FastAPI: se muestra la primera regla incumplida.
        message = `Dato inválido: ${body.detail[0].msg}`;
      }
    } catch {
      if (raw.trim()) {
        message = raw;
      }
    }
    return new ApiError(response.status, message);
  }
}
