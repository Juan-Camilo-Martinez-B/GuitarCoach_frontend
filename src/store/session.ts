import { create } from "zustand";
import type { StrumPattern } from "../domain/course";
import type { Song, SongStudy } from "../domain/types";

export type TeachingMode = "acordes" | "notas";

const TOKEN_KEY = "guitarcoach-token";

function readToken(): string | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  return sessionStorage.getItem(TOKEN_KEY);
}

interface SessionState {
  token: string | null;
  /** Aviso breve cuando la API rechaza la sesión. Salir no lo escribe. */
  notice: string | null;
  latencyOffsetMs: number;
  song: Song | null;
  study: SongStudy | null;
  teachingMode: TeachingMode;
  lastAttemptId: string | null;
  /** Rasgueo de la guía que abrió la práctica; null usa el del catálogo. */
  practicePattern: StrumPattern | null;
  /** False cuando los golpes de la guía son un supuesto: no se guarda la puntuación. */
  scoreTiming: boolean;
  setToken: (token: string | null) => void;
  forgetExpiredSession: () => void;
  setLatencyOffsetMs: (value: number) => void;
  setSong: (song: Song | null) => void;
  setStudy: (study: SongStudy | null) => void;
  setTeachingMode: (mode: TeachingMode) => void;
  setLastAttemptId: (attemptId: string | null) => void;
  setPracticePattern: (pattern: StrumPattern | null) => void;
  setScoreTiming: (scoreTiming: boolean) => void;
}

export const useSession = create<SessionState>((set) => ({
  token: readToken(),
  notice: null,
  latencyOffsetMs: 0,
  song: null,
  study: null,
  teachingMode: "acordes",
  lastAttemptId: null,
  practicePattern: null,
  scoreTiming: true,
  setToken: (token) => {
    if (typeof sessionStorage !== "undefined") {
      if (token) {
        sessionStorage.setItem(TOKEN_KEY, token);
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
      }
    }
    set(token ? { token, notice: null } : { token });
  },
  forgetExpiredSession: () => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(TOKEN_KEY);
    }
    set({
      token: null,
      notice: "La sesión venció. Entra de nuevo para ver tus canciones.",
    });
  },
  setLatencyOffsetMs: (latencyOffsetMs) => set({ latencyOffsetMs }),
  setSong: (song) => set({ song }),
  setStudy: (study) => set({ study }),
  setTeachingMode: (teachingMode) => set({ teachingMode }),
  setLastAttemptId: (lastAttemptId) => set({ lastAttemptId }),
  setPracticePattern: (practicePattern) => set({ practicePattern }),
  setScoreTiming: (scoreTiming) => set({ scoreTiming }),
}));
