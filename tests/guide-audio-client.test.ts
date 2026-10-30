import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/api/client";

describe("guía desde un audio", () => {
  it("envía el audio con título, artista, melodía y el token", async () => {
    const fetchImpl = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            id: "g1",
            song_id: 4,
            title: "Toma",
            artist: "Ana",
            bpm: 96,
            source_kind: "audio",
            status: "borrador",
            updated_at: "2026-10-30T00:00:00Z",
            guide: { version: 1, sections: [], chords: [], melody: [] },
          }),
          { status: 201 },
        ),
    );
    const file = new File([new Uint8Array([82, 73, 70, 70])], "toma.wav", { type: "audio/wav" });
    const record = await new ApiClient("http://api", fetchImpl, "abc").guideFromAudio(
      file,
      "Toma",
      "Ana",
      true,
    );
    expect(record.sourceKind).toBe("audio");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("http://api/guides/from-audio");
    const body = init?.body as FormData;
    expect(body.get("title")).toBe("Toma");
    expect(body.get("melody")).toBe("true");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer abc");
  });
});
