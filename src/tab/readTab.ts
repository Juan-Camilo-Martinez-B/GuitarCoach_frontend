import type { WireGuide } from "../api/guides";
import { defaultTrack, isTabFile, tabFileProblem } from "./tabFile";

export { isTabFile };

/**
 * Lee la tablatura en el navegador y arma su guía. alphaTab se descarga solo aquí,
 * la primera vez que alguien sube una tablatura.
 */
export async function readTabBytes(bytes: Uint8Array, fallbackTitle: string): Promise<WireGuide> {
  const [{ importer }, { scoreToGuide }, { trackInfo }] = await Promise.all([
    import("@coderline/alphatab"),
    import("./scoreToGuide"),
    import("./trackInfo"),
  ]);
  let score;
  try {
    score = importer.ScoreLoader.loadScoreFromBytes(bytes);
  } catch {
    throw new Error("No se pudo leer la tablatura. Prueba con otro archivo o formato.");
  }
  return scoreToGuide(score, defaultTrack(score.tracks.map(trackInfo)), fallbackTitle);
}

export async function readTab(file: File): Promise<WireGuide> {
  const problem = tabFileProblem(file);
  if (problem) {
    throw new Error(problem);
  }
  const stem = file.name.replace(/\.[^.]+$/, "");
  return readTabBytes(new Uint8Array(await file.arrayBuffer()), stem);
}
