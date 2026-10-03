import { describe, expect, it } from "vitest";
import { buildTelemetry } from "../src/audio/workers/session.worker";
import { layoutChart } from "../src/game/ChartRenderer";
import { GameLoop, practiceCommand } from "../src/game/GameLoop";
import { judgeHit } from "../src/game/ScoringEngine";

describe("juego", () => {
  it("sale de la cuenta atrás y puntúa dentro de la ventana", () => {
    const loop = new GameLoop();
    loop.start(1000);
    loop.tick(1000);
    expect(loop.phase).toBe("playing");
    expect(practiceCommand("Enter", loop.phase)).toBe("finish");
    expect(judgeHit("C", "C", 40)).toBe("hit");
    expect(judgeHit("C", "G", 10)).toBe("miss");
    expect(judgeHit("C", "C", 200)).toBe("miss");
  });

  it("dibuja una caja por acorde y resume la telemetría", () => {
    const boxes = layoutChart(["C", "G"], 100);
    expect(boxes[1].x).toBe(50);
    const payload = buildTelemetry([
      { bar: 1, expected: "C", detected: "C", deltaMs: 20, confidence: 0.9 },
    ]);
    expect(payload.accuracy).toBe(100);
  });
});
