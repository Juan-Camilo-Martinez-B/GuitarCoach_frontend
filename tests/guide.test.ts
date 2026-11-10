import { describe, expect, it } from "vitest";
import { guideToWire } from "../src/api/guides";
import { isChordSymbol } from "../src/domain/chart";
import {
  appendSection,
  barsFromText,
  barsToText,
  bpmFromUs,
  ensureGrid,
  chordChangeLabels,
  eventsInBar,
  firstPlayedSection,
  guideHits,
  mergeChordBack,
  hasWrittenMelody,
  prepareLesson,
  soundingMelody,
  strumBar,
  pulseToSeconds,
  removeSection,
  replaceSectionChords,
  songFromGuide,
  strumFromText,
  strumToText,
  totalBeats,
  type SongGuide,
} from "../src/domain/guide";

function sample(): SongGuide {
  return {
    version: 1,
    title: "Prueba",
    artist: "Ana",
    song_key: "G",
    bpm: 90,
    beats_per_bar: 4,
    capo: 0,
    sections: [
      { name: "Intro", start: 0, beats: 8, strum: { directions: ["abajo"], beats: [4] } },
      {
        name: "Coro",
        start: 8,
        beats: 4,
        strum: { directions: ["abajo", "arriba"], beats: [2, 2] },
      },
    ],
    chords: [
      { start: 0, beats: 4, chord: "G" },
      { start: 4, beats: 4, chord: "D" },
      { start: 8, beats: 2, chord: "Am" },
      { start: 10, beats: 2, chord: "C" },
    ],
    melody: [{ start: 9, beats: 1, midi: 69 }],
  };
}

describe("guía de canción", () => {
  it("toca cada compás con el rasgueo de su sección", () => {
    const hits = guideHits(sample());
    expect(hits.map((hit) => [hit.at, hit.chord, hit.direction])).toEqual([
      [0, 0, "abajo"],
      [4, 1, "abajo"],
      [8, 2, "abajo"],
      [10, 3, "arriba"],
    ]);
  });

  it("no cambia el rasgueo plano según el nombre de la sección", () => {
    const guide = sample();
    guide.sections = [
      {
        name: "Intro",
        start: 0,
        beats: 4,
        strum: { directions: ["abajo", "abajo", "abajo", "abajo"], beats: [1, 1, 1, 1] },
      },
      {
        name: "Chorus",
        start: 4,
        beats: 4,
        strum: { directions: ["abajo", "abajo", "abajo", "abajo"], beats: [1, 1, 1, 1] },
      },
    ];
    guide.chords = [
      { start: 0, beats: 4, chord: "G" },
      { start: 4, beats: 4, chord: "C" },
    ];
    const hits = guideHits(guide);
    expect(hits.filter((hit) => hit.section === 0).map((hit) => hit.at)).toEqual([0, 1, 2, 3]);
    expect(hits.filter((hit) => hit.section === 1).map((hit) => hit.at)).toEqual([4, 5, 6, 7]);
    expect(hits.every((hit) => hit.origin === "inferido")).toBe(true);
  });

  it("no hereda el fraseo de otra canción y respeta el compás", () => {
    const guide = sample();
    guide.melody = [];
    guide.sections = [
      { name: "Verse", start: 0, beats: 12, strum: { directions: ["abajo"], beats: [4] } },
    ];
    guide.chords = ["Am", "G", "C"].map((chord, index) => ({
      start: index * 4,
      beats: 4,
      chord,
    }));
    const grid = ensureGrid(guide);
    expect(grid.chords.map((chord) => chord.chord)).toEqual(["Am", "G", "C"]);
    expect(grid.capo).toBe(0);
    const waltz = { ...sample(), beats_per_bar: 3, chords: [{ start: 0, beats: 3, chord: "Am" }] };
    waltz.sections = [
      { name: "Verse", start: 0, beats: 3, strum: { directions: ["abajo"], beats: [3] } },
    ];
    expect(ensureGrid(waltz).beats_per_bar).toBe(3);
    expect(guideHits(waltz).map((hit) => hit.hold)).toEqual([3]);
  });

  it("conserva la razón de los huecos y del cambio de tempo a media velocidad", () => {
    const tempo = [
      { pulse: 0, usPerQuarter: 500_000 },
      { pulse: 2, usPerQuarter: 1_000_000 },
    ];
    const slow = 0.5;
    const first = pulseToSeconds(0.5, tempo, slow) - pulseToSeconds(0, tempo, slow);
    const second = pulseToSeconds(2, tempo, slow) - pulseToSeconds(0.5, tempo, slow);
    expect(second / first).toBeCloseTo(3, 5);
    const before = pulseToSeconds(2, tempo, slow) - pulseToSeconds(0, tempo, slow);
    const after = pulseToSeconds(4, tempo, slow) - pulseToSeconds(2, tempo, slow);
    expect(after / before).toBeCloseTo(2, 5);
    expect(pulseToSeconds(2, tempo, 1) / pulseToSeconds(2, tempo, slow)).toBeCloseTo(0.5, 5);
  });

  it("al fundir los dos últimos, el tercero dura dos compases", () => {
    const guide = ensureGrid({
      ...sample(),
      melody: [],
      sections: [
        { name: "Canción", start: 0, beats: 12, strum: { directions: ["abajo"], beats: [4] } },
      ],
      chords: [
        { start: 0, beats: 4, chord: "G" },
        { start: 4, beats: 4, chord: "D" },
        { start: 8, beats: 4, chord: "Em" },
      ],
    });
    const merged = mergeChordBack(guide, 2);
    expect(merged.chords.map((chord) => [chord.chord, chord.beats])).toEqual([
      ["G", 4],
      ["Em", 8],
    ]);
    expect(merged.events?.find((event) => event.pulse === 4)?.span).toBe(8);
    expect(merged.events?.find((event) => event.pulse === 4)?.origin).toBe("editado");
  });

  it("toca solo la sección elegida, contando desde su inicio", () => {
    const hits = guideHits(sample(), 8, 12);
    expect(hits.map((hit) => [hit.at, hit.chord, hit.section])).toEqual([
      [0, 2, 1],
      [2, 3, 1],
    ]);
  });

  it("escribe y vuelve a leer los compases de una sección", () => {
    const guide = sample();
    expect(barsToText(guide, guide.sections[0])).toBe("| G | D |");
    // Dos acordes iguales en el compás se escriben sin puntos.
    expect(barsToText(guide, guide.sections[1])).toBe("| Am C |");
    const expected = {
      chords: [
        { start: 8, beats: 2, chord: "Am" },
        { start: 10, beats: 2, chord: "C" },
      ],
      beats: 4,
    };
    expect(barsFromText("| Am C |", 8, 4, isChordSymbol)).toEqual(expected);
    expect(barsFromText("| Am . C . |", 8, 4, isChordSymbol)).toEqual(expected);
    // Un acorde corto al final sí necesita casilleros.
    expect(
      barsToText(
        {
          ...guide,
          chords: [
            { start: 0, beats: 3, chord: "G" },
            { start: 3, beats: 1, chord: "D" },
          ],
        },
        { ...guide.sections[0], beats: 4 },
      ),
    ).toBe("| G . . D |");
  });

  it("rechaza un acorde que no existe en el editor", () => {
    expect(() => barsFromText("| G | H7 |", 0, 4, isChordSymbol)).toThrow("H7");
  });

  it("lee y escribe el rasgueo en casilleros", () => {
    const strum = strumFromText("D-DU-UDU", 4);
    expect(strum.directions).toEqual(["abajo", "abajo", "arriba", "arriba", "abajo", "arriba"]);
    expect(strum.beats).toEqual([1, 0.5, 1, 0.5, 0.5, 0.5]);
    expect(strumToText(strum)).toBe("D-DU-UDU");
    expect(() => strumFromText("-DU", 4)).toThrow();
  });

  it("alarga una sección y corre lo que viene después", () => {
    const guide = sample();
    const { chords, beats } = barsFromText("| G | D | Em |", 0, 4, isChordSymbol);
    const next = replaceSectionChords(guide, 0, chords, beats);
    expect(next.sections[1].start).toBe(12);
    expect(next.chords.map((chord) => [chord.start, chord.chord])).toEqual([
      [0, "G"],
      [4, "D"],
      [8, "Em"],
      [12, "Am"],
      [14, "C"],
    ]);
    expect(next.melody[0].start).toBe(13);
  });

  it("quita una sección y adelanta la siguiente", () => {
    const next = removeSection(sample(), 0);
    expect(next.sections).toHaveLength(1);
    expect(next.sections[0].start).toBe(0);
    expect(next.chords.map((chord) => chord.start)).toEqual([0, 2]);
    expect(() => removeSection(next, 0)).toThrow();
  });

  it("agrega una sección de un compás al final", () => {
    const next = appendSection(sample(), "Final");
    expect(next.sections.at(-1)).toMatchObject({ name: "Final", start: 12, beats: 4 });
    expect(totalBeats(next)).toBe(16);
  });

  it("arma la canción plana para la práctica con compás y pulso desde uno", () => {
    const song = songFromGuide({
      id: "g1",
      songId: 7,
      title: "Prueba",
      artist: "Ana",
      bpm: 90,
      sourceKind: "pegado",
      status: "borrador",
      updatedAt: "",
      guide: { ...sample(), capo: 3 },
    });
    expect(song?.id).toBe(7);
    expect(song?.capo).toBe(3);
    expect(song?.chords.slice(2)).toEqual([
      { bar: 3, beat: 1, chord: "Am" },
      { bar: 3, beat: 3, chord: "C" },
    ]);
  });

  it("para practicar una sección solo deja sus acordes, con el número de compás de la canción", () => {
    const guide: SongGuide = {
      ...sample(),
      chords: [
        { start: 0, beats: 4, chord: "G" },
        // Viene sonando desde la intro y sigue en el coro: entra desde donde empieza el coro.
        { start: 4, beats: 6, chord: "D" },
        { start: 10, beats: 2, chord: "C" },
      ],
    };
    const record = {
      id: "g1",
      songId: 7,
      title: "Prueba",
      artist: "Ana",
      bpm: 90,
      sourceKind: "pegado" as const,
      status: "borrador" as const,
      updatedAt: "",
      guide,
    };
    const chorus = songFromGuide(record, 1);
    expect(chorus?.title).toBe("Prueba · Coro");
    expect(chorus?.chords).toEqual([
      { bar: 3, beat: 1, chord: "D" },
      { bar: 3, beat: 3, chord: "C" },
    ]);
    expect(songFromGuide(record, 0)?.chords.map((chord) => chord.chord)).toEqual(["G", "D"]);
    expect(songFromGuide(record)?.chords).toHaveLength(3);
    expect(songFromGuide(record, 5)).toBeNull();
  });

  it("prepara una lección copiable cuando la carta no trae rasgueo ni melodía", () => {
    const flat: SongGuide = {
      ...sample(),
      melody: [],
      sections: [
        {
          name: "Intro",
          start: 0,
          beats: 4,
          strum: { directions: ["abajo", "abajo", "abajo", "abajo"], beats: [1, 1, 1, 1] },
        },
      ],
      chords: [{ start: 0, beats: 4, chord: "Am" }],
      events: [
        {
          pulse: 0,
          span: 1,
          direction: "abajo",
          contact: "golpe",
          velocity: 0.8,
          origin: "inferido",
        },
        {
          pulse: 1,
          span: 1,
          direction: "abajo",
          contact: "golpe",
          velocity: 0.8,
          origin: "inferido",
        },
        {
          pulse: 2,
          span: 1,
          direction: "abajo",
          contact: "golpe",
          velocity: 0.8,
          origin: "inferido",
        },
        {
          pulse: 3,
          span: 1,
          direction: "abajo",
          contact: "golpe",
          velocity: 0.8,
          origin: "inferido",
        },
      ],
    };
    const lesson = prepareLesson(flat);
    expect(lesson.events?.map((event) => event.span)).toEqual([1, 1, 0.5, 0.5, 1]);
    expect(lesson.events?.every((event) => event.origin === "leccion")).toBe(true);
    expect(lesson.melody.map((note) => note.midi)).toEqual([69, 72]);
    const again = prepareLesson(lesson);
    expect(again.events).toEqual(lesson.events);
    expect(again.melody).toEqual(lesson.melody);

    const written = prepareLesson({
      ...flat,
      events: [
        {
          pulse: 0,
          span: 2,
          direction: "abajo",
          contact: "golpe",
          velocity: 0.8,
          origin: "escrito",
        },
        {
          pulse: 2,
          span: 2,
          direction: "arriba",
          contact: "golpe",
          velocity: 0.8,
          origin: "escrito",
        },
      ],
    });
    expect(written.events?.map((event) => event.span)).toEqual([2, 2]);
    expect(written.melody).toHaveLength(2);
  });

  it("distingue la melodía escrita de la guía armónica, también la guardada", () => {
    const chords = [{ start: 0, beats: 4, chord: "Am" }];
    const empty: SongGuide = { ...sample(), chords, melody: [], capo: 2 };
    expect(hasWrittenMelody(empty)).toBe(false);
    // La guía armónica sale de las formas: con cejilla 2 suena dos semitonos arriba.
    expect(soundingMelody(empty).map((note) => note.midi)).toEqual([71, 74]);

    const stored = { ...empty, melody: prepareLesson(empty).melody };
    expect(hasWrittenMelody(stored)).toBe(false);

    const real = { ...empty, melody: [{ start: 0, beats: 1, midi: 64 }] };
    expect(hasWrittenMelody(real)).toBe(true);
    // Las notas escritas ya son la altura que suena: la cejilla no se suma otra vez.
    expect(soundingMelody(real).map((note) => note.midi)).toEqual([64]);
  });

  it("lee el tempo que guarda el servidor en microsegundos por negra", () => {
    const grid = ensureGrid({
      ...sample(),
      tempo: [{ pulse: 0, us_per_quarter: 750_000 }] as unknown as SongGuide["tempo"],
    });
    expect(bpmFromUs(grid.tempo![0].usPerQuarter)).toBe(80);
  });

  it("manda el tempo a la API como us_per_quarter, también después de editar", () => {
    const edited = ensureGrid({ ...sample(), tempo: undefined });
    const wire = guideToWire(edited);
    expect(wire.tempo[0]).toEqual({ pulse: 0, us_per_quarter: edited.tempo![0].usPerQuarter });
    expect(JSON.stringify(wire)).not.toContain("usPerQuarter");
    expect(wire.events.length).toBeGreaterThan(0);
  });

  it("enseña un compás del rasgueo y salta la intro donde la guitarra no toca", () => {
    const strike = (pulse: number, direction: "abajo" | "arriba") => ({
      pulse,
      span: 1,
      direction,
      contact: "golpe" as const,
      velocity: 0.8,
      origin: "escrito" as const,
    });
    const guide: SongGuide = {
      ...sample(),
      sections: [
        { name: "Intro", start: 0, beats: 4, strum: { directions: ["abajo"], beats: [4] } },
        { name: "Verso", start: 4, beats: 8, strum: { directions: ["abajo"], beats: [4] } },
      ],
      chords: [{ start: 0, beats: 12, chord: "Am" }],
      events: [4, 5, 6, 7, 8, 9, 10, 11].map((pulse) =>
        strike(pulse, pulse % 2 === 0 ? "abajo" : "arriba"),
      ),
    };
    expect(firstPlayedSection(guide)).toBe(1);
    expect(strumBar(guide, 0)).toEqual([]);
    expect(strumBar(guide, 1).map((event) => event.direction)).toEqual([
      "abajo",
      "arriba",
      "abajo",
      "arriba",
    ]);
  });

  it("marca el golpe en el que cambia el acorde y deja quieto el que sigue igual", () => {
    const hit = (pulse: number) => ({
      pulse,
      span: 1,
      direction: "abajo" as const,
      contact: "golpe" as const,
      velocity: 0.8,
      origin: "escrito" as const,
    });
    const guide: SongGuide = {
      ...sample(),
      beats_per_bar: 4,
      sections: [
        { name: "Todo", start: 0, beats: 8, strum: { directions: ["abajo"], beats: [1] } },
      ],
      chords: [
        { start: 0, beats: 4, chord: "Am" },
        { start: 4, beats: 4, chord: "G" },
      ],
      events: [0, 1, 2, 3, 4, 5].map(hit),
    };
    expect(chordChangeLabels(guide, eventsInBar(guide, 0))).toEqual(["Am", null, null, null]);
    expect(chordChangeLabels(guide, eventsInBar(guide, 4))).toEqual(["G", null]);
  });
});
