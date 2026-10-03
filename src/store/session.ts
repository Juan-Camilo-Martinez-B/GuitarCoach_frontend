import { create } from "zustand";
import type { Song } from "../domain/types";

interface SessionState {
  token: string | null;
  latencyOffsetMs: number;
  song: Song | null;
  setToken: (token: string | null) => void;
  setLatencyOffsetMs: (value: number) => void;
  setSong: (song: Song | null) => void;
}

export const useSession = create<SessionState>((set) => ({
  token: null,
  latencyOffsetMs: 0,
  song: null,
  setToken: (token) => set({ token }),
  setLatencyOffsetMs: (latencyOffsetMs) => set({ latencyOffsetMs }),
  setSong: (song) => set({ song }),
}));
