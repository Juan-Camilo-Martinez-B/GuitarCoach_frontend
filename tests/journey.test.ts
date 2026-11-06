import { describe, expect, it } from "vitest";
import { splitGlossary } from "../src/domain/glossary";
import {
  BADGES,
  completeMilestone,
  EMPTY_JOURNEY,
  liveStreak,
  nextStep,
  parseJourney,
  recordDay,
} from "../src/domain/journey";
import { TAB_SOURCES } from "../src/domain/tabSources";
import { sectionFor } from "../src/layout/navigation";

describe("racha", () => {
  it("suma días seguidos, cuenta cada día una vez y se reinicia tras un hueco", () => {
    const first = recordDay(EMPTY_JOURNEY, "2026-02-28");
    expect(first.streak).toBe(1);
    expect(recordDay(first, "2026-02-28")).toBe(first);
    const second = recordDay(first, "2026-03-01");
    expect(second.streak).toBe(2);
    const broken = recordDay(second, "2026-03-05");
    expect(broken.streak).toBe(1);
    expect(broken.bestStreak).toBe(2);
  });

  it("no muestra una racha que ya se perdió", () => {
    const progress = recordDay(EMPTY_JOURNEY, "2026-03-01");
    expect(liveStreak(progress, "2026-03-02")).toBe(1);
    expect(liveStreak(progress, "2026-03-04")).toBe(0);
  });
});

describe("ruta y logros", () => {
  it("sugiere el primer paso pendiente y gana el logro que corresponde", () => {
    expect(nextStep(EMPTY_JOURNEY)?.id).toBe("afinar");
    const tuned = completeMilestone(EMPTY_JOURNEY, "afinar");
    expect(nextStep(tuned)?.id).toBe("acorde");
    expect(BADGES.filter((badge) => badge.earned(tuned)).map((badge) => badge.id)).toEqual([
      "buen-oido",
    ]);
  });

  it("ignora lo guardado que no tiene la forma esperada", () => {
    expect(parseJourney("no es json")).toEqual(EMPTY_JOURNEY);
    expect(parseJourney('{"milestones":["afinar","trampa"],"lastDay":"ayer","streak":-3}')).toEqual(
      { milestones: ["afinar"], days: [], lastDay: null, streak: 0, bestStreak: 0 },
    );
  });
});

describe("glosario", () => {
  it("marca solo la primera aparición de cada término y respeta las palabras completas", () => {
    expect(splitGlossary("El traste y otro traste")).toEqual([
      "El ",
      { id: "traste", text: "traste" },
      " y otro traste",
    ]);
    expect(splitGlossary("Contrastes")).toEqual(["Contrastes"]);
    expect(splitGlossary("Usa la cuenta de entrada")).toEqual([
      "Usa la ",
      { id: "cuenta-entrada", text: "cuenta de entrada" },
    ]);
  });
});

describe("navegación", () => {
  it("ubica cada ruta en su sección", () => {
    expect(sectionFor("/")?.id).toBe("inicio");
    expect(sectionFor("/afinador")?.id).toBe("practicar");
    expect(sectionFor("/canciones/g1")?.id).toBe("progreso");
    expect(sectionFor("/entrar")).toBeNull();
  });
});

describe("fuentes de tablaturas", () => {
  it("solo enlaza a direcciones seguras", () => {
    expect(TAB_SOURCES.length).toBeGreaterThan(0);
    for (const source of TAB_SOURCES) {
      expect(source.url.startsWith("https://")).toBe(true);
    }
  });
});
