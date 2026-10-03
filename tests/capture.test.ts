import { describe, expect, it } from "vitest";
import { pushSamples } from "../src/audio/worklets/capture.worklet";

describe("captura", () => {
  it("no publica un bloque hasta llenar el tamaño pedido", () => {
    const buffer: number[] = [];
    expect(pushSamples(buffer, new Float32Array([1, 2]), 4)).toBeNull();
    const chunk = pushSamples(buffer, new Float32Array([3, 4]), 4);
    expect(chunk).toEqual(new Float32Array([1, 2, 3, 4]));
    expect(buffer).toHaveLength(0);
  });
});
