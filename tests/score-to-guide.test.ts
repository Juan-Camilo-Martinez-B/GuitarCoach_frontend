import { importer } from "@coderline/alphatab";
import { describe, expect, it } from "vitest";
import { scoreToGuide } from "../src/tab/scoreToGuide";

const TUNING = [
  ["E", 2],
  ["A", 2],
  ["D", 3],
  ["G", 3],
  ["B", 3],
  ["E", 4],
]
  .map(
    ([step, octave], index) =>
      `<staff-tuning line="${index + 1}"><tuning-step>${step}</tuning-step><tuning-octave>${octave}</tuning-octave></staff-tuning>`,
  )
  .join("");

function note(
  step: string,
  octave: number,
  string: number,
  fret: number,
  extra = "",
  duration = 1,
): string {
  const type = duration === 4 ? "whole" : duration === 2 ? "half" : "quarter";
  return `<note>${extra}<pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>${duration}</duration><voice>1</voice><type>${type}</type><notations><technical><string>${string}</string><fret>${fret}</fret></technical></notations></note>`;
}

function cluster(pieces: string[]): string {
  return pieces
    .map((piece, index) => (index === 0 ? piece : piece.replace("<note>", "<note><chord/>")))
    .join("");
}

function shape(frets: Array<[string, number, number, number]>, duration = 4): string {
  return cluster(
    frets.map(([step, octave, string, fret]) => note(step, octave, string, fret, "", duration)),
  );
}

const AM = shape([
  ["A", 2, 5, 0],
  ["E", 3, 4, 2],
  ["A", 3, 3, 2],
  ["C", 4, 2, 1],
]);
const G = shape([
  ["G", 2, 6, 3],
  ["B", 2, 5, 2],
  ["D", 3, 4, 0],
  ["G", 3, 3, 0],
]);
const C = shape([
  ["C", 3, 5, 3],
  ["E", 3, 4, 2],
  ["G", 3, 3, 0],
  ["C", 4, 2, 1],
]);
const F = shape([
  ["F", 2, 6, 1],
  ["C", 3, 5, 3],
  ["F", 3, 4, 3],
  ["A", 3, 3, 2],
]);
const EM = shape([
  ["E", 2, 6, 0],
  ["B", 2, 5, 2],
  ["E", 3, 4, 2],
  ["G", 3, 3, 0],
]);

function score(measures: string[], harmony = ""): Uint8Array {
  const attributes = `<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef><staff-details><staff-lines>6</staff-lines>${TUNING}</staff-details></attributes><direction><sound tempo="102"/></direction>`;
  const body = measures
    .map(
      (content, index) =>
        `<measure number="${index + 1}">${index === 0 ? attributes + harmony : ""}${content}</measure>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><work><work-title>Riff</work-title></work><part-list><score-part id="P1"><part-name>Guitarra</part-name></score-part></part-list><part id="P1">${body}</part></score-partwise>`;
  return new TextEncoder().encode(xml);
}

// Compás 1: Mi menor arpegiado. Compás 2: Do mayor arpegiado.
const E_MINOR = [note("E", 2, 6, 0), note("G", 3, 3, 0), note("B", 3, 2, 0), note("E", 4, 1, 0)];
const C_MAJOR = [note("C", 3, 5, 3), note("E", 3, 4, 2), note("G", 3, 3, 0), note("C", 4, 2, 1)];

describe("de la tablatura a la guía", () => {
  it("toma las notas reales, el tempo y deduce el acorde de cada compás", () => {
    const parsed = importer.ScoreLoader.loadScoreFromBytes(
      score([E_MINOR.join(""), C_MAJOR.join("")]),
    );
    const guide = scoreToGuide(parsed, 0, "riff");
    expect(guide.title).toBe("Riff");
    expect(guide.bpm).toBe(102);
    expect(guide.beats_per_bar).toBe(4);
    expect(guide.melody.map((item) => item.midi)).toEqual([40, 55, 59, 64, 48, 52, 55, 60]);
    expect(guide.melody[4]).toEqual({ start: 4, beats: 1, midi: 48 });
    expect(guide.chords).toEqual([
      { start: 0, beats: 4, chord: "Em" },
      { start: 4, beats: 4, chord: "C" },
    ]);
    expect(guide.tempo[0]).toEqual({ pulse: 0, us_per_quarter: 588_235 });
    expect(guide.sections).toHaveLength(1);
    expect(guide.sections[0]).toMatchObject({ start: 0, beats: 8 });
    expect(guide.events.map((event) => [event.pulse, event.span, event.origin])).toEqual([
      [0, 4, "escrito"],
      [4, 4, "escrito"],
    ]);
  });

  it("con cejilla, el acorde es la forma que pisa la mano y la melodía suena real", () => {
    const parsed = importer.ScoreLoader.loadScoreFromBytes(score([E_MINOR.join("")]));
    parsed.tracks[0].staves[0].capo = 2;
    const guide = scoreToGuide(parsed, 0, "riff");
    expect(guide.capo).toBe(2);
    expect(guide.chords[0].chord).toBe("Em");
    expect(guide.melody.map((item) => item.midi)).toEqual([42, 57, 61, 66]);
  });

  it("una pista sin notas no se puede convertir", () => {
    const rest = `<note><rest/><duration>4</duration><voice>1</voice><type>whole</type></note>`;
    const parsed = importer.ScoreLoader.loadScoreFromBytes(score([rest]));
    expect(() => scoreToGuide(parsed, 0, "x")).toThrow(/notas/);
  });

  it("sigue los acordes cuando el cifrado escrito se corta", () => {
    const label = `<direction><direction-type><words>Lam</words></direction-type></direction>`;
    const parsed = importer.ScoreLoader.loadScoreFromBytes(score([`${label}${AM}`, C, G, EM]));
    const guide = scoreToGuide(parsed, 0, "ligera");
    expect(guide.chords.map((chord) => chord.chord)).toEqual(["Am", "C", "G", "Em"]);
    expect(guide.events.map((event) => event.pulse)).toEqual([0, 4, 8, 12]);
  });

  it("reconoce verso y coro en una tablatura sin marcas", () => {
    const verse = [AM, G, C, F];
    const chorus = [C, G, AM, F];
    const parsed = importer.ScoreLoader.loadScoreFromBytes(
      score([...verse, ...verse, ...chorus, ...chorus]),
    );
    const guide = scoreToGuide(parsed, 0, "ligera");
    expect(guide.sections.map((section) => section.name)).toEqual([
      "Verso 1",
      "Verso 2",
      "Coro 1",
      "Coro 2",
    ]);
  });

  it("usa las marcas de verso y coro del archivo", () => {
    const verse = `<direction><direction-type><rehearsal>Verse 1</rehearsal></direction-type></direction>${AM}`;
    const chorus = `<direction><direction-type><rehearsal>Chorus</rehearsal></direction-type></direction>${C}`;
    const parsed = importer.ScoreLoader.loadScoreFromBytes(
      score([verse, G, C, F, AM, G, C, F, chorus, G, AM, F, C, G, AM, F]),
    );
    const guide = scoreToGuide(parsed, 0, "ligera");
    expect(guide.sections.map((section) => section.name)).toEqual(["Verso 1", "Coro"]);
  });
});
