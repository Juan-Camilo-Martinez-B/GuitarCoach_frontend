import type { Page, Route } from "@playwright/test";

const API = "http://localhost:8000";

export const CATALOG = [
  {
    id: 1,
    title: "Cambios abiertos",
    artist: "GuitarCoach",
    song_key: "G",
    bpm: 72,
    chords: [
      { bar: 1, beat: 1, chord: "G" },
      { bar: 2, beat: 1, chord: "D" },
      { bar: 3, beat: 1, chord: "Em" },
      { bar: 4, beat: 1, chord: "C" },
    ],
  },
];

interface GuidePayload {
  id: string;
  song_id: number;
  title: string;
  artist: string;
  bpm: number;
  source_kind: string;
  status: string;
  updated_at: string;
  guide: Record<string, unknown>;
}

export interface ApiState {
  guides: GuidePayload[];
  puts: Array<Record<string, unknown>>;
  pastes: Array<Record<string, unknown>>;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
}

function sampleGuide(title: string, artist: string, bpm: number): Record<string, unknown> {
  return {
    version: 1,
    title,
    artist,
    song_key: null,
    bpm,
    beats_per_bar: 4,
    capo: 0,
    sections: [
      {
        name: "Intro",
        start: 0,
        beats: 8,
        strum: { directions: ["abajo", "abajo", "arriba"], beats: [2, 1, 1] },
      },
      {
        name: "Coro",
        start: 8,
        beats: 4,
        strum: { directions: ["abajo"], beats: [4] },
      },
    ],
    chords: [
      { start: 0, beats: 4, chord: "G" },
      { start: 4, beats: 4, chord: "D" },
      { start: 8, beats: 2, chord: "Am" },
      { start: 10, beats: 2, chord: "C" },
    ],
    melody: [],
  };
}

/** Simula la API para que las pruebas no dependan del backend ni de la base. */
export async function mockApi(page: Page): Promise<ApiState> {
  const state: ApiState = { guides: [], puts: [], pastes: [] };
  await page.route(`${API}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    if (method === "OPTIONS") {
      return route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
          "access-control-allow-headers": "authorization,content-type",
        },
      });
    }
    if (path === "/songs") {
      return json(route, CATALOG);
    }
    if (/^\/songs\/\d+\/study$/.test(path)) {
      return json(route, {
        summary: "Cuatro acordes abiertos a 72 BPM.",
        difficulty: "facil",
        chords: [],
        melody: [],
      });
    }
    if (path === "/me/curriculum") {
      return json(route, { needs_review: false, review: [], lessons: [] });
    }
    if (path === "/me/progress") {
      return json(route, [
        {
          attempt_id: "a1",
          song_id: 1,
          song_title: "Cambios abiertos",
          accuracy: 75,
          avg_delta_ms: 40,
          created_at: "2026-10-29T15:00:00Z",
        },
      ]);
    }
    if (path === "/attempts/a1/report" && method === "POST") {
      return json(route, {
        id: "r1",
        attempt_id: "a1",
        diagnostico: "El cambio de Re a Mim llega tarde.",
        ejercicios: ["Cambia de Re a Mim diez veces."],
        plan_semanal: ["Lunes: cambios lentos."],
        consejos_tecnica: ["Anticipa el dedo de la cuerda 5."],
        model: "local",
      });
    }
    if (path === "/guides" && method === "GET") {
      return json(route, state.guides);
    }
    if (path === "/guides/paste" && method === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      state.pastes.push(body);
      const created: GuidePayload = {
        id: "g1",
        song_id: 9,
        title: String(body.title),
        artist: String(body.artist),
        bpm: Number(body.bpm ?? 80),
        source_kind: "pegado",
        status: "borrador",
        updated_at: "2026-10-30T10:00:00Z",
        guide: sampleGuide(String(body.title), String(body.artist), Number(body.bpm ?? 80)),
      };
      state.guides = [created];
      return json(route, created, 201);
    }
    const guideMatch = /^\/guides\/([\w-]+)$/.exec(path);
    if (guideMatch) {
      const found = state.guides.find((guide) => guide.id === guideMatch[1]);
      if (!found) {
        return json(route, { code: "not_found", message: "La guía no existe." }, 404);
      }
      if (method === "PUT") {
        const body = request.postDataJSON() as { status: string; guide: Record<string, unknown> };
        state.puts.push(body);
        found.status = body.status;
        found.guide = body.guide;
        found.title = String(body.guide.title);
      }
      return json(route, found);
    }
    return json(route, { code: "not_found", message: `Sin simular: ${method} ${path}` }, 404);
  });
  return state;
}

/** Deja la sesión abierta como si la persona ya hubiera entrado. */
export async function signedIn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    sessionStorage.setItem("guitarcoach-token", "token-de-prueba");
  });
}
