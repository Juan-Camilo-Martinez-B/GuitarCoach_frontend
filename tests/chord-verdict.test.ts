import { describe, expect, it } from "vitest";
import { judgementVerdict } from "../src/game/chordVerdict";

describe("veredicto del acorde", () => {
  it("felicita cuando suena el acorde pedido", () => {
    expect(judgementVerdict("Em", true, "Em")).toEqual({ text: "Bien. Sonó Mim.", kind: "bien" });
  });

  it("dice qué se oyó cuando no coincide", () => {
    expect(judgementVerdict("G", false, "Em")).toEqual({
      text: "Se oye Sol, no Mim. Revisa los dedos.",
      kind: "no",
    });
  });

  it("espera mientras no se reconoce ningún acorde", () => {
    expect(judgementVerdict(null, false, "Em").kind).toBe("espera");
  });
});
