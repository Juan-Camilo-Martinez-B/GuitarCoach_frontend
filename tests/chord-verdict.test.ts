import { describe, expect, it } from "vitest";
import { chordVerdict, chordVerdictText } from "../src/game/chordVerdict";

describe("veredicto del acorde", () => {
  it("acepta la fundamental del acorde esperado", () => {
    expect(chordVerdict("E", "Em")).toBe("bien");
    expect(chordVerdictText("E", "Em")).toBe("Bien. Tocaste Mim.");
  });

  it("rechaza otra nota y espera el silencio", () => {
    expect(chordVerdict("G", "Em")).toBe("no");
    expect(chordVerdictText("G", "Em")).toBe("No. Se oyó G, no Mim.");
    expect(chordVerdict(null, "Em")).toBe("espera");
  });
});
