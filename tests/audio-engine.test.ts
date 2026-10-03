import { describe, expect, it } from "vitest";
import { AudioEngine } from "../src/audio/engine/AudioEngine";

describe("motor de audio", () => {
  it("pasa a escuchando cuando el micrófono responde", async () => {
    const engine = new AudioEngine({ request: async () => undefined });
    await engine.start();
    expect(engine.state).toBe("listening");
  });

  it("distingue un permiso denegado de otro fallo", async () => {
    const denied = new AudioEngine({
      request: async () => {
        const error = new Error("bloqueado");
        error.name = "NotAllowedError";
        throw error;
      },
    });
    await denied.start();
    expect(denied.state).toBe("denied");
    const broken = new AudioEngine({
      request: async () => {
        throw new Error("sin dispositivo");
      },
    });
    await broken.start();
    expect(broken.state).toBe("error");
  });
});
