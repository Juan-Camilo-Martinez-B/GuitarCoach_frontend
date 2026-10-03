import { describe, expect, it } from "vitest";
import { RingBuffer } from "../src/audio/engine/RingBuffer";

describe("buffer circular", () => {
  it("devuelve las muestras en orden y avisa cuando está lleno", () => {
    const buffer = new RingBuffer(2);
    expect(buffer.push(1)).toBe(true);
    expect(buffer.push(2)).toBe(true);
    expect(buffer.push(3)).toBe(false);
    expect(buffer.pull()).toBe(1);
    expect(buffer.pull()).toBe(2);
    expect(buffer.pull()).toBeNull();
  });
});
