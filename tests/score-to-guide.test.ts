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

function note(step: string, octave: number, string: number, fret: number, extra = ""): string {
  return `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>1</duration><voice>1</voice><type>quarter</type>${extra}<notations><technical><string>${string}</string><fret>${fret}</fret></technical></notations></note>`;
}

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
});
