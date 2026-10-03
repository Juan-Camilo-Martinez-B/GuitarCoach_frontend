import { describe, expect, it } from "vitest";
import { ClockService } from "../src/audio/engine/ClockService";

describe("reloj de la sesión", () => {
  it("descuenta el offset de latencia al contar pulsos", () => {
    let now = 0;
    const clock = new ClockService(() => now);
    clock.start();
    now = 2000;
    expect(clock.beat(60, 500)).toBeCloseTo(1.5);
    clock.pause();
    now = 9000;
    expect(clock.elapsedMs()).toBe(2000);
  });
});
