import { create } from "zustand";
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
  latencyOffsetMs: number;
  song: Song | null;
  study: SongStudy | null;
  teachingMode: TeachingMode;
  lastAttemptId: string | null;
  setToken: (token: string | null) => void;
  setLatencyOffsetMs: (value: number) => void;
  setSong: (song: Song | null) => void;
  setStudy: (study: SongStudy | null) => void;
  setTeachingMode: (mode: TeachingMode) => void;
  setLastAttemptId: (attemptId: string | null) => void;
}

export const useSession = create<SessionState>((set) => ({
  token: readToken(),
  latencyOffsetMs: 0,
  song: null,
  study: null,
  teachingMode: "acordes",
  lastAttemptId: null,
  setToken: (token) => {
    if (typeof sessionStorage !== "undefined") {
      if (token) {
        sessionStorage.setItem(TOKEN_KEY, token);
      } else {
        sessionStorage.removeItem(TOKEN_KEY);
      }
    }
    set({ token });
  },
  setLatencyOffsetMs: (latencyOffsetMs) => set({ latencyOffsetMs }),
  setSong: (song) => set({ song }),
  setStudy: (study) => set({ study }),
  setTeachingMode: (teachingMode) => set({ teachingMode }),
  setLastAttemptId: (lastAttemptId) => set({ lastAttemptId }),
}));
