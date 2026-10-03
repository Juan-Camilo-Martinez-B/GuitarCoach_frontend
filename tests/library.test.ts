import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/api/client";
import { pollJob, songFromPayload } from "../src/api/songs";

describe("biblioteca e informe", () => {
  it("normaliza una canción y espera el trabajo", async () => {
    const song = songFromPayload({
      id: 3,
      title: "Muestra",
      artist: "Demo",
      song_key: "C",
      bpm: 80,
      chords: [{ bar: 1, beat: 1, chord: "C" }],
    });
    expect(song.songKey).toBe("C");
    const statuses = ["pending", "done"];
    const status = await pollJob(
      async () => ({ status: statuses.shift() ?? "done" }),
      async () => undefined,
    );
    expect(status).toBe("done");
  });

  it("pide el progreso con el token guardado", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify([
            {
              attempt_id: "a1",
              song_id: 3,
              accuracy: 80,
              avg_delta_ms: 20,
              created_at: "2026-10-03T00:00:00Z",
            },
          ]),
          { status: 200 },
        ),
    );
    const points = await new ApiClient("http://localhost:8000", fetchImpl, "abc").progress();
    expect(points[0].accuracy).toBe(80);
  });
});
