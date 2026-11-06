import { create } from "zustand";
import { ApiClient, type JourneyPayload } from "../api/client";
import {
  BADGES,
  completeMilestone,
  dayKey,
  EMPTY_JOURNEY,
  parseJourney,
  recordDay,
  type Badge,
  type JourneyProgress,
  type MilestoneId,
} from "../domain/journey";
import { useSession } from "./session";

const KEY = "guitarcoach-journey";
const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function load(): JourneyProgress {
  try {
    return typeof localStorage === "undefined"
      ? EMPTY_JOURNEY
      : parseJourney(localStorage.getItem(KEY));
  } catch {
    return EMPTY_JOURNEY;
  }
}

function persist(progress: JourneyProgress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* almacenamiento bloqueado o lleno: el avance vale solo para esta visita */
  }
}

function fromServer(payload: JourneyPayload): JourneyProgress {
  return {
    milestones: payload.milestones,
    days: payload.days,
    lastDay: payload.days[payload.days.length - 1] ?? null,
    streak: payload.current_streak,
    bestStreak: payload.best_streak,
  };
}

interface JourneyState {
  progress: JourneyProgress;
  /** Los logros recién ganados, para avisarlos una vez. */
  fresh: Badge[];
  /** Una señal de práctica real: suma el día a la racha y, si se indica, cumple un paso. */
  record: (milestone?: MilestoneId) => void;
  /** Sube lo guardado en este navegador y trae lo que ya tiene la cuenta. */
  sync: () => Promise<void>;
  /** Al salir se olvida: el equipo puede ser compartido y la cuenta ya lo tiene guardado. */
  forget: () => void;
  dismissFresh: () => void;
}

let syncing = false;
let syncAgain = false;

// Sin sesión el avance vive en este navegador; con sesión, la cuenta manda.
export const useJourney = create<JourneyState>((set, get) => ({
  progress: load(),
  fresh: [],
  record: (milestone) => {
    const before = get().progress;
    const dated = recordDay(before, dayKey(new Date()));
    const next = milestone ? completeMilestone(dated, milestone) : dated;
    if (next === before) {
      return;
    }
    persist(next);
    const unlocked = BADGES.filter((badge) => badge.earned(next) && !badge.earned(before));
    set((state) => ({ progress: next, fresh: [...state.fresh, ...unlocked] }));
    void get().sync();
  },
  sync: async () => {
    const token = useSession.getState().token;
    if (!token) {
      return;
    }
    // Un aviso que llega durante otro se junta en uno solo al terminar.
    if (syncing) {
      syncAgain = true;
      return;
    }
    syncing = true;
    try {
      const sent = get().progress;
      const payload = await new ApiClient(apiUrl, fetch, token).saveJourney(
        dayKey(new Date()),
        sent.milestones,
        sent.days,
      );
      // Si la sesión cambió mientras tanto, esta respuesta ya no es de quien está aquí.
      if (useSession.getState().token !== token) {
        return;
      }
      const next = fromServer(payload);
      persist(next);
      const before = get().progress;
      const unlocked = BADGES.filter((badge) => badge.earned(next) && !badge.earned(before));
      set((state) => ({ progress: next, fresh: [...state.fresh, ...unlocked] }));
    } catch {
      // Sin conexión el avance sigue aquí; se vuelve a enviar con el próximo aviso, sin duplicar.
    } finally {
      syncing = false;
      if (syncAgain) {
        syncAgain = false;
        void get().sync();
      }
    }
  },
  forget: () => {
    persist(EMPTY_JOURNEY);
    set({ progress: EMPTY_JOURNEY, fresh: [] });
  },
  dismissFresh: () => set({ fresh: [] }),
}));
