import { describe, expect, it } from "vitest";
import { latencyOffset } from "../src/audio/calibration";
import { practiceCommand } from "../src/game/GameLoop";

describe("calibración y teclado", () => {
  it("promedia el retraso de los toques respecto al pulso", () => {
    expect(latencyOffset([140, 160], [100, 100])).toBe(50);
    expect(latencyOffset([], [])).toBe(0);
  });

  it("solo arranca con espacio y cierra con enter", () => {
    expect(practiceCommand(" ", "idle")).toBe("start");
    expect(practiceCommand("a", "idle")).toBeNull();
    expect(practiceCommand("Enter", "playing")).toBe("finish");
    expect(practiceCommand(" ", "playing")).toBeNull();
  });
});
