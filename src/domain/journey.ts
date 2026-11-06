import type { IconName } from "../ui/Icon";

export type MilestoneId = "afinar" | "acorde" | "tocar" | "propia" | "avance";

export interface JourneyStep {
  id: MilestoneId;
  title: string;
  text: string;
  path: string;
  action: string;
  icon: IconName;
}

/** El recorrido sugerido para quien nunca ha tocado: cada paso prepara el siguiente. */
export const JOURNEY_STEPS: JourneyStep[] = [
  {
    id: "afinar",
    title: "Afina tu guitarra",
    text: "Una guitarra desafinada hace que todo suene mal, aunque lo hagas bien.",
    path: "/afinador",
    action: "Abrir el afinador",
    icon: "tuner",
  },
  {
    id: "acorde",
    title: "Aprende tu primer acorde",
    text: "Mira dónde van los dedos, escúchalo y prueba a imitarlo.",
    path: "/aprendizaje?modulo=acorde",
    action: "Ver el acorde",
    icon: "book",
  },
  {
    id: "tocar",
    title: "Toca una canción fácil",
    text: "Elige una canción de práctica. El micrófono te dirá si el acorde suena bien.",
    path: "/biblioteca",
    action: "Elegir canción",
    icon: "guitar",
  },
  {
    id: "propia",
    title: "Sube una canción que te guste",
    text: "Con un archivo gratuito de Guitar Pro, la app arma tu guía de estudio.",
    path: "/canciones",
    action: "Buscar y subir",
    icon: "music",
  },
  {
    id: "avance",
    title: "Revisa tu avance",
    text: "Mira cómo vas y qué te conviene practicar después.",
    path: "/informe",
    action: "Ver mi informe",
    icon: "chart",
  },
];

export interface JourneyProgress {
  milestones: MilestoneId[];
  /** Días con práctica, para subirlos a la cuenta sin perder ninguno. */
  days: string[];
  /** Último día con práctica, como AAAA-MM-DD en la hora local. */
  lastDay: string | null;
  streak: number;
  bestStreak: number;
}

export const EMPTY_JOURNEY: JourneyProgress = {
  milestones: [],
  days: [],
  lastDay: null,
  streak: 0,
  bestStreak: 0,
};

// Lo que acepta la API en un aviso.
const MAX_LOCAL_DAYS = 400;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function previousDay(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return dayKey(new Date(year, month - 1, day - 1));
}

/** Suma el día a la racha una sola vez; un día sin practicar la reinicia. */
export function recordDay(progress: JourneyProgress, today: string): JourneyProgress {
  if (progress.lastDay === today) {
    return progress;
  }
  const streak = progress.lastDay === previousDay(today) ? progress.streak + 1 : 1;
  return {
    ...progress,
    days: [...progress.days, today].slice(-MAX_LOCAL_DAYS),
    lastDay: today,
    streak,
    bestStreak: Math.max(progress.bestStreak, streak),
  };
}

/** La racha que se puede mostrar hoy: si ya pasó más de un día sin practicar, está perdida. */
export function liveStreak(progress: JourneyProgress, today: string): number {
  return progress.lastDay === today || progress.lastDay === previousDay(today)
    ? progress.streak
    : 0;
}

export function completeMilestone(progress: JourneyProgress, id: MilestoneId): JourneyProgress {
  return progress.milestones.includes(id)
    ? progress
    : { ...progress, milestones: [...progress.milestones, id] };
}

export function nextStep(progress: JourneyProgress): JourneyStep | null {
  return JOURNEY_STEPS.find((step) => !progress.milestones.includes(step.id)) ?? null;
}

export interface Badge {
  id: string;
  title: string;
  text: string;
  icon: IconName;
  earned: (progress: JourneyProgress) => boolean;
}

const hasMilestone = (id: MilestoneId) => (progress: JourneyProgress) =>
  progress.milestones.includes(id);

export const BADGES: Badge[] = [
  {
    id: "buen-oido",
    title: "Buen oído",
    text: "Afinaste tu guitarra.",
    icon: "tuner",
    earned: hasMilestone("afinar"),
  },
  {
    id: "primer-acorde",
    title: "Primer acorde",
    text: "Viste cómo se arma un acorde.",
    icon: "book",
    earned: hasMilestone("acorde"),
  },
  {
    id: "primera-cancion",
    title: "A tocar",
    text: "Empezaste a practicar una canción.",
    icon: "guitar",
    earned: hasMilestone("tocar"),
  },
  {
    id: "mi-cancion",
    title: "Mi propia canción",
    text: "Subiste una canción que te gusta.",
    icon: "music",
    earned: hasMilestone("propia"),
  },
  {
    id: "tres-dias",
    title: "Tres días seguidos",
    text: "Practicaste tres días sin pausa.",
    icon: "flame",
    earned: (progress) => progress.bestStreak >= 3,
  },
  {
    id: "ruta-completa",
    title: "Ruta completa",
    text: "Terminaste los cinco pasos.",
    icon: "star",
    earned: (progress) => JOURNEY_STEPS.every((step) => progress.milestones.includes(step.id)),
  },
];

const MILESTONE_IDS = new Set<string>(JOURNEY_STEPS.map((step) => step.id));

/** Lee lo guardado sin confiar en su forma: el navegador lo puede haber alterado. */
export function parseJourney(raw: string | null): JourneyProgress {
  if (!raw) {
    return EMPTY_JOURNEY;
  }
  try {
    const value = JSON.parse(raw) as Partial<JourneyProgress>;
    const count = (item: unknown) =>
      typeof item === "number" && Number.isInteger(item) && item >= 0 ? item : 0;
    return {
      milestones: Array.isArray(value.milestones)
        ? value.milestones.filter((id) => MILESTONE_IDS.has(id))
        : [],
      days: Array.isArray(value.days)
        ? value.days
            .filter((day) => typeof day === "string" && DAY_PATTERN.test(day))
            .slice(-MAX_LOCAL_DAYS)
        : [],
      lastDay:
        typeof value.lastDay === "string" && DAY_PATTERN.test(value.lastDay) ? value.lastDay : null,
      streak: count(value.streak),
      bestStreak: count(value.bestStreak),
    };
  } catch {
    return EMPTY_JOURNEY;
  }
}
