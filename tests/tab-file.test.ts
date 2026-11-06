import { describe, expect, it } from "vitest";
import {
  defaultTrack,
  formatClock,
  isGuitarTrack,
  MAX_TAB_BYTES,
  tabFileProblem,
  type TrackInfo,
} from "../src/tab/tabFile";

const SIX = [64, 59, 55, 50, 45, 40];

function track(
  index: number,
  name: string,
  staff: Partial<TrackInfo["staves"][number]>,
): TrackInfo {
  return {
    index,
    name,
    staves: [{ isPercussion: false, showTablature: false, tuning: [], ...staff }],
  };
}

describe("tablaturas", () => {
  it("acepta solo Guitar Pro dentro del tamaño", () => {
    expect(tabFileProblem({ name: "Cancion.GP5", size: 2000 })).toBeNull();
    expect(tabFileProblem({ name: "tema.gpx", size: 10 })).toBeNull();
    expect(tabFileProblem({ name: "tema.gp", size: 10 })).toBeNull();
    expect(tabFileProblem({ name: "riff.musicxml", size: 10 })).toMatch(/Guitar Pro/);
    expect(tabFileProblem({ name: "tema.mid", size: 10 })).toMatch(/Guitar Pro/);
    expect(tabFileProblem({ name: "letra.txt", size: 10 })).toMatch(/Guitar Pro/);
    expect(tabFileProblem({ name: "vacio.gp", size: 0 })).toMatch(/vacío/);
    expect(tabFileProblem({ name: "grande.gp", size: MAX_TAB_BYTES + 1 })).toMatch(/5 MB/);
  });

  it("elige la guitarra y no la batería ni la voz", () => {
    const tracks = [
      track(0, "Drums", { isPercussion: true }),
      track(1, "Voz", {}),
      track(2, "Pista 3", { tuning: SIX }),
    ];
    expect(isGuitarTrack(tracks[0])).toBe(false);
    expect(isGuitarTrack(tracks[2])).toBe(true);
    expect(defaultTrack(tracks)).toBe(2);
    expect(defaultTrack([track(0, "Batería", { isPercussion: true }), track(1, "Bajo", {})])).toBe(
      1,
    );
    expect(defaultTrack([])).toBe(0);
    // Guitar Pro da seis cuerdas también a la voz: manda el nombre.
    const band = [
      track(0, "Vocals", { tuning: SIX }),
      track(1, "Ukulele", { tuning: [67, 64, 60, 69] }),
      track(2, "Nylon Guitar", { tuning: SIX }),
    ];
    expect(isGuitarTrack(band[0])).toBe(false);
    expect(defaultTrack(band)).toBe(2);
  });

  it("muestra el tiempo como minutos y segundos", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65_400)).toBe("1:05");
  });
});
