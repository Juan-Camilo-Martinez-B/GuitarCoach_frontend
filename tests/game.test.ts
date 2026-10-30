import { describe, expect, it } from "vitest";
import { layoutChart } from "../src/game/ChartRenderer";
import { GameLoop, practiceCommand } from "../src/game/GameLoop";

describe("juego", () => {
  it("sale de la cuenta atrás y pasa a tocar", () => {
    const loop = new GameLoop();
    loop.start(1000);
    loop.tick(1000);
    expect(loop.phase).toBe("playing");
    expect(practiceCommand("Enter", loop.phase)).toBe("finish");
  });

  it("solo arranca con espacio y cierra con enter", () => {
    expect(practiceCommand(" ", "idle")).toBe("start");
    expect(practiceCommand("a", "idle")).toBeNull();
    expect(practiceCommand("Enter", "playing")).toBe("finish");
    expect(practiceCommand(" ", "playing")).toBeNull();
  });

  it("dibuja una caja por acorde", () => {
    const boxes = layoutChart(["C", "G"], 100);
    expect(boxes[1].x).toBe(50);
  });
});
