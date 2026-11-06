/**
 * Archivos de Guitar Pro 3 en adelante: traen cuerda, traste, rasgueo y técnica de cada
 * golpe. GP3, GP4 y GP5 usan su número; Guitar Pro 6 es .gpx y Guitar Pro 7 y 8, .gp.
 */
export const TAB_EXTENSIONS = [".gp", ".gp3", ".gp4", ".gp5", ".gpx"] as const;

export const MAX_TAB_BYTES = 5 * 1024 * 1024;

export const TAB_ACCEPT = TAB_EXTENSIONS.join(",");

export function isTabFile(name: string): boolean {
  const lower = name.toLowerCase();
  return TAB_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** Devuelve el motivo del rechazo, o null si el archivo se puede abrir. */
export function tabFileProblem(file: { name: string; size: number }): string | null {
  if (!isTabFile(file.name)) {
    return "Sube una tablatura de Guitar Pro (.gp3, .gp4, .gp5, .gpx o .gp).";
  }
  if (file.size === 0) {
    return "El archivo está vacío.";
  }
  if (file.size > MAX_TAB_BYTES) {
    return "La tablatura supera 5 MB.";
  }
  return null;
}

/** Lo mínimo de una pista que hace falta para elegir cuál enseñar. */
export interface TrackInfo {
  index: number;
  name: string;
  staves: Array<{ isPercussion: boolean; showTablature: boolean; tuning: number[] }>;
}

const GUITAR_WORDS = ["guit", "guitar", "guitarra", "gtr"];
// Guitar Pro da seis cuerdas a toda pista nueva, también a la voz: el nombre las descarta.
const NOT_GUITAR_WORDS = [
  "vocal",
  "voice",
  "voz",
  "bass",
  "bajo",
  "drum",
  "bater",
  "perc",
  "piano",
  "key",
  "uke",
  "ukulele",
  "string",
  "violin",
  "synth",
];

function pitched(track: TrackInfo): boolean {
  return track.staves.length > 0 && !track.staves.some((staff) => staff.isPercussion);
}

function named(track: TrackInfo, words: string[]): boolean {
  const name = track.name.toLowerCase();
  return words.some((word) => name.includes(word));
}

export function isGuitarTrack(track: TrackInfo): boolean {
  if (!pitched(track)) {
    return false;
  }
  if (named(track, GUITAR_WORDS)) {
    return true;
  }
  // Sin nombre de guitarra: seis cuerdas o tablatura, salvo que el nombre diga otra cosa.
  return (
    !named(track, NOT_GUITAR_WORDS) &&
    track.staves.some((staff) => staff.tuning.length === 6 || staff.showTablature)
  );
}

/**
 * La pista que se enseña: primero la que se llama guitarra, luego la que lo parece por sus
 * cuerdas, y si no hay ninguna, la primera que no sea batería.
 */
export function defaultTrack(tracks: TrackInfo[]): number {
  const choice =
    tracks.find((track) => pitched(track) && named(track, GUITAR_WORDS)) ??
    tracks.find(isGuitarTrack) ??
    tracks.find(pitched) ??
    tracks[0];
  return choice?.index ?? 0;
}

export function formatClock(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
