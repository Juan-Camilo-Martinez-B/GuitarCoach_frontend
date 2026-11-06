import { readFileSync } from "node:fs";
import type { Page, Route } from "@playwright/test";

const API = "http://localhost:8000";

/** Tablatura de prueba (Guitar Pro 7): rasgueo de Mim y Do en corcheas, con una pista de voz. */
export const TAB_FIXTURE = new URL("../fixtures/rasgueo-prueba.gp", import.meta.url);

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
  {
    id: 2,
    title: "Lamento boliviano",
    artist: "GuitarCoach",
    song_key: "Am",
    bpm: 120,
    chords: [
      { bar: 1, beat: 1, chord: "Am" },
      { bar: 3, beat: 1, chord: "Em" },
      { bar: 5, beat: 1, chord: "Dm" },
      { bar: 7, beat: 1, chord: "Am" },
      { bar: 8, beat: 1, chord: "E7" },
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

export interface AttemptPayload {
  song_id: number;
  bpm: number;
  events: Array<{
    bar: number;
    expected: string;
    detected: string | null;
    delta_ms: number;
    confidence: number;
  }>;
}

export interface ApiState {
  guides: GuidePayload[];
  puts: Array<Record<string, unknown>>;
  uploads: Array<Record<string, unknown>>;
  journeySaves: Array<{ milestones: string[]; days: string[] }>;
  attempts: AttemptPayload[];
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
}

/** La guía va como un campo de texto del formulario multipart, junto al archivo. */
function guideField(body: Buffer): Record<string, unknown> {
  const text = body.toString("latin1");
  const separator = "\r\n\r\n";
  const start = text.indexOf(separator, text.indexOf('name="guide"')) + separator.length;
  const end = text.indexOf("\r\n--", start);
  const raw = Buffer.from(text.slice(start, end), "latin1").toString("utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

/** Simula la API para que las pruebas no dependan del backend ni de la base. */
export async function mockApi(page: Page): Promise<ApiState> {
  const state: ApiState = { guides: [], puts: [], uploads: [], journeySaves: [], attempts: [] };
  const tab = readFileSync(TAB_FIXTURE);
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
    if (path === "/me/journey") {
      const body = route.request().postDataJSON() as {
        milestones: string[];
        days: string[];
      };
      state.journeySaves.push(body);
      return json(route, {
        milestones: body.milestones,
        days: body.days,
        current_streak: body.days.length > 0 ? 1 : 0,
        best_streak: body.days.length > 0 ? 1 : 0,
        badges: [],
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
    if (path === "/attempts" && method === "POST") {
      const attempt = request.postDataJSON() as AttemptPayload;
      state.attempts.push(attempt);
      const right = attempt.events.filter((event) => event.expected === event.detected).length;
      return json(
        route,
        { id: "a1", accuracy: (right / attempt.events.length) * 100, avg_delta_ms: 0 },
        201,
      );
    }
    if (path === "/attempts/a1/report" && method === "POST") {
      return json(route, {
        id: "r1",
        attempt_id: "a1",
        diagnostico: "El cambio de Re a Mim llega tarde.",
        ejercicios: ["Cambia de Re a Mim diez veces."],
        plan_semanal: ["Lunes: cambios lentos."],
        consejos_tecnica: ["Anticipa el dedo de la cuerda 5."],
        model: "analisis-local",
      });
    }
    if (path === "/guides" && method === "GET") {
      return json(route, state.guides);
    }
    if (path === "/guides/from-tab" && method === "POST") {
      const guide = guideField(request.postDataBuffer() ?? Buffer.alloc(0));
      state.uploads.push(guide);
      const created: GuidePayload = {
        id: "g1",
        song_id: 9,
        title: String(guide.title),
        artist: String(guide.artist),
        bpm: Number(guide.bpm),
        source_kind: "tablatura",
        status: "borrador",
        updated_at: "2026-10-30T10:00:00Z",
        guide,
      };
      state.guides = [created];
      return json(route, created, 201);
    }
    if (/^\/guides\/[\w-]+\/tab$/.test(path) && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/octet-stream",
        headers: { "access-control-allow-origin": "*" },
        body: tab,
      });
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
