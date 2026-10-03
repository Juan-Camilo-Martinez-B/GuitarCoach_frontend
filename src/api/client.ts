import type { AttemptSummary, ReportView, Song } from "../domain/types";
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
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = fetch,
    private token: string | null = null,
  ) {}

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
      throw new ApiError(response.status, `La API respondió ${response.status}.`);
    }
    return response;
  }
}
