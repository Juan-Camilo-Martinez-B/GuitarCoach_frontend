import { describe, expect, it } from "vitest";
import { onsetOffset, SampleBank } from "../src/audio/guitar/sampleBank";

function response(ok: boolean, type: string): Response {
  return new Response(ok ? new ArrayBuffer(8) : null, {
    status: ok ? 200 : 404,
    headers: { "content-type": type },
  });
}

describe("banco de muestras", () => {
  it("salta el silencio que el MP3 deja antes del ataque", () => {
    const channel = new Float32Array(1000);
    channel[500] = 0.8;
    // 500 muestras a 1000 Hz menos 2 ms de margen.
    expect(onsetOffset(channel, 1000)).toBeCloseTo(0.498);
  });

  it("no mueve una muestra muda", () => {
    expect(onsetOffset(new Float32Array(10), 44100)).toBe(0);
  });

  it("usa el CDN cuando la carpeta local responde la página de la app", async () => {
    const asked: string[] = [];
    const bank = new SampleBank(["/local", "https://cdn"], async (url) => {
      asked.push(url);
      return url.startsWith("/local") ? response(true, "text/html") : response(true, "audio/mpeg");
    });
    const context = {
      decodeAudioData: async () => ({
        duration: 1,
        sampleRate: 1000,
        getChannelData: () => new Float32Array([0, 1]),
      }),
    } as unknown as BaseAudioContext;
    const loaded = await bank.loadAll(context, [40]);
    expect(asked).toEqual(["/local/E2.mp3", "https://cdn/E2.mp3"]);
    expect(loaded.get(40)?.offset).toBe(0);
  });
});
