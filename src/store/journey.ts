import { create } from "zustand";
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

const KEY = "guitarcoach-journey";

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

interface JourneyState {
  progress: JourneyProgress;
  /** Los logros recién ganados, para avisarlos una vez. */
  fresh: Badge[];
  /** Una señal de práctica real: suma el día a la racha y, si se indica, cumple un paso. */
  record: (milestone?: MilestoneId) => void;
  dismissFresh: () => void;
}

// El avance vive solo en este navegador: motiva, pero no es un dato de la cuenta.
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
  },
  dismissFresh: () => set({ fresh: [] }),
}));
