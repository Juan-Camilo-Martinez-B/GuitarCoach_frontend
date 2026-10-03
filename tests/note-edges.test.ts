import { describe, expect, it } from "vitest";
import { noteFromFrequency } from "../src/audio/dsp/noteMath";

describe("cents en el borde", () => {
  it("marca bemol una nota apenas por debajo del la", () => {
    const reading = noteFromFrequency(430);
    expect(reading.name).toBe("A");
    expect(reading.cents).toBeLessThan(0);
  });

  it("no cruza a la siguiente nota antes del punto medio", () => {
    const reading = noteFromFrequency(450);
    expect(reading.name).toBe("A");
    expect(reading.cents).toBeGreaterThan(0);
  });
});
