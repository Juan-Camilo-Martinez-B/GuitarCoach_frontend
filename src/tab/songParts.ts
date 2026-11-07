import type { GuideChord, GuideSection, SongGuide } from "../domain/guide";

export interface PartMark {
  start: number;
  name: string;
}

const ROLES: Array<[RegExp, string]> = [
  [/^(introducci[oó]n|intro)\b/i, "Intro"],
  [/^(pre[\s-]?estribillo|pre[\s-]?coro|pre[\s-]?chorus)\b/i, "Pre-coro"],
  [/^(estribillo|chorus|coro|refr[aá]n|refrain)\b/i, "Coro"],
  [/^(verso|verse|estrofa|stanza)\b/i, "Verso"],
  [/^(puente|bridge)\b/i, "Puente"],
  [/^(solo)\b/i, "Solo"],
  [/^(interludio|interlude|instrumental)\b/i, "Interludio"],
  [/^(outro|coda|final|ending)\b/i, "Final"],
];

const KNOWN_ROLES = new Set(ROLES.map(([, name]) => name));

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** «Parte 1» o «Section 3» no dicen qué se toca. Un verso o un coro sí. */
export function isGenericPartName(name: string): boolean {
  return /^(parte|part|secci[oó]n|section)(\s+\d+)?$/i.test(name.trim());
}

/** «Verse 1» y «Estribillo» pasan a los nombres que usa la app. */
export function prettifySectionName(raw: string): string {
  const clean = raw
    .trim()
    .replace(/[:.\-–]+$/g, "")
    .replace(/\s+/g, " ");
  if (!clean) {
    return "";
  }
  for (const [pattern, name] of ROLES) {
    const match = pattern.exec(clean);
    if (!match) {
      continue;
    }
    const rest = clean
      .slice(match[0].length)
      .trim()
      .replace(/^[:.\-–]+/, "")
      .trim();
    const number = /^(\d+)/.exec(rest);
    return number ? `${name} ${number[1]}` : name;
  }
  return clean.slice(0, 40);
}

/**
 * Un texto corto escrito sobre un golpe («Coro», «Verso 2») marca una parte.
 * Una frase de la letra no.
 */
export function sectionLabelFromText(raw: string): string | null {
  const clean = raw.trim();
  if (!clean || clean.length > 32 || clean.split(/\s+/).length > 4) {
    return null;
  }
  const pretty = prettifySectionName(clean);
  const role = pretty.replace(/ \d+$/, "");
  return KNOWN_ROLES.has(role) ? pretty : null;
}

function barCount(total: number, beatsPerBar: number): number {
  if (beatsPerBar <= 0 || total <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil((total - 1e-6) / beatsPerBar));
}

/** Un compás se reconoce por los acordes que empiezan en él, o por el que sigue sonando. */
export function barSignatures(chords: GuideChord[], total: number, beatsPerBar: number): string[] {
  const count = barCount(total, beatsPerBar);
  const signatures: string[] = [];
  for (let bar = 0; bar < count; bar += 1) {
    const start = bar * beatsPerBar;
    const end = Math.min(total, start + beatsPerBar);
    const changes = chords.filter(
      (chord) => chord.start >= start - 1e-6 && chord.start < end - 1e-6,
    );
    if (changes.length > 0) {
      signatures.push(changes.map((chord) => chord.chord).join(">"));
      continue;
    }
    const held = [...chords].reverse().find((chord) => chord.start < start + 1e-6);
    signatures.push(held?.chord || signatures.at(-1) || "");
  }
  return signatures;
}

interface PhraseOption {
  length: number;
  offset: number;
  score: number;
  distinct: number;
}

function phraseKey(bars: string[], start: number, length: number): string {
  return bars.slice(start, start + length).join("|");
}

function phraseOption(bars: string[], length: number): PhraseOption {
  let best: PhraseOption = { length, offset: 0, score: 0, distinct: 0 };
  if (bars.length < length * 2) {
    return best;
  }
  const maxOffset = Math.min(length - 1, bars.length - length * 2);
  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const counts = new Map<string, number>();
    let phrases = 0;
    for (let index = offset; index + length <= bars.length; index += length) {
      const key = phraseKey(bars, index, length);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      phrases += 1;
    }
    let repeated = 0;
    let distinct = 0;
    for (const count of counts.values()) {
      if (count >= 2) {
        repeated += count;
        distinct += 1;
      }
    }
    const score = phrases === 0 ? 0 : repeated / phrases;
    if (score > best.score || (score === best.score && distinct > best.distinct)) {
      best = { length, offset, score, distinct };
    }
  }
  return best;
}

interface Segment {
  startBar: number;
  bars: string[];
  key: string;
}

function segmentsOf(bars: string[], length: number, offset: number): Segment[] {
  const segments: Segment[] = [];
  if (offset > 0) {
    segments.push({
      startBar: 0,
      bars: bars.slice(0, offset),
      key: bars.slice(0, offset).join("|"),
    });
  }
  for (let index = offset; index < bars.length; index += length) {
    const slice = bars.slice(index, Math.min(bars.length, index + length));
    segments.push({ startBar: index, bars: slice, key: slice.join("|") });
  }
  return segments;
}

function chordTitle(bars: string[]): string {
  const chords: string[] = [];
  for (const bar of bars) {
    for (const chord of bar.split(">")) {
      if (chord && chords.at(-1) !== chord) {
        chords.push(chord);
      }
    }
  }
  return chords.slice(0, 5).join(" ");
}

function named(segments: Segment[]): string[] {
  const counts = new Map<string, number>();
  for (const segment of segments) {
    counts.set(segment.key, (counts.get(segment.key) ?? 0) + 1);
  }
  const longest = Math.max(...segments.map((segment) => segment.bars.length));
  const isFull = (segment: Segment) => segment.bars.length >= longest;
  const role = new Map<string, string>();
  const first = segments[0];
  const last = segments[segments.length - 1];
  // Una intro es más corta que el verso: lo que sobra antes de que la frase encaje.
  if (segments.length > 1 && counts.get(first.key) === 1 && !isFull(first)) {
    role.set(first.key, "Intro");
  }
  if (segments.length > 2 && counts.get(last.key) === 1 && !isFull(last) && !role.has(last.key)) {
    role.set(last.key, "Final");
  }
  const repeated: string[] = [];
  const once: string[] = [];
  for (const segment of segments) {
    if (role.has(segment.key)) {
      continue;
    }
    const count = counts.get(segment.key) ?? 0;
    if (count >= 2 && !repeated.includes(segment.key)) {
      repeated.push(segment.key);
    } else if (count === 1 && isFull(segment) && !once.includes(segment.key)) {
      once.push(segment.key);
    }
  }
  if (repeated.length >= 2) {
    role.set(repeated[0], "Verso");
    role.set(repeated[1], "Coro");
    for (const key of repeated.slice(2)) {
      role.set(key, "Estrofa");
    }
    for (const key of once) {
      role.set(key, "Puente");
    }
  } else if (repeated.length === 1 && once.length > 0) {
    role.set(once[0], "Verso");
    role.set(repeated[0], "Coro");
    for (const key of once.slice(1)) {
      role.set(key, "Puente");
    }
  } else if (repeated[0]) {
    role.set(repeated[0], "Verso");
  }
  for (const segment of segments) {
    if (!role.has(segment.key)) {
      role.set(segment.key, segments.length === 1 ? "Canción" : "Puente");
    }
  }
  const bridges = [...role.values()].filter((name) => name === "Puente").length;
  const seen = new Map<string, number>();
  return segments.map((segment) => {
    const base = role.get(segment.key) ?? "Canción";
    const total = counts.get(segment.key) ?? 1;
    const number = (seen.get(segment.key) ?? 0) + 1;
    seen.set(segment.key, number);
    if (base === "Canción" || base === "Intro" || base === "Final") {
      return base;
    }
    if (base === "Puente" && total === 1 && bridges === 1) {
      return "Puente";
    }
    return `${base} ${number}`;
  });
}

function marksFrom(segments: Segment[], names: string[], beatsPerBar: number): PartMark[] {
  return segments.map((segment, index) => ({
    start: round(segment.startBar * beatsPerBar),
    name: names[index] || "Canción",
  }));
}

/**
 * Sin marcas en el archivo, el verso y el coro se reconocen porque su progresión
 * se repite. Una parte que solo aparece al principio es la intro; al final, el cierre.
 */
export function inferPartMarks(
  chords: GuideChord[],
  total: number,
  beatsPerBar: number,
): PartMark[] {
  const bars = barSignatures(chords, total, beatsPerBar);
  const used = new Set(bars.filter((bar) => bar.length > 0));
  if (bars.length === 0 || used.size <= 1) {
    return [{ start: 0, name: "Canción" }];
  }
  const options = [4, 8, 16, 2].map((length) => phraseOption(bars, length));
  const viable = options.filter((option) => option.score >= 0.5 && option.distinct >= 1);
  // 4 y 8 compases son una parte. 2 solo sirve si la canción no repite nada más largo:
  // si no, parte el verso por la mitad y lo confunde con el coro.
  const comfortable = viable.filter((option) => option.length >= 4);
  const pool = comfortable.length > 0 ? comfortable : viable;
  pool.sort((left, right) => {
    if (Math.abs(left.score - right.score) > 0.05) {
      return right.score - left.score;
    }
    const leftSplit = left.distinct >= 2;
    const rightSplit = right.distinct >= 2;
    if (leftSplit !== rightSplit) {
      return leftSplit ? -1 : 1;
    }
    return leftSplit ? left.length - right.length : right.length - left.length;
  });
  const chosen = pool[0];
  if (!chosen) {
    const titles: string[] = [];
    for (let start = 0; start < bars.length; start += 8) {
      titles.push(chordTitle(bars.slice(start, start + 8)) || "Canción");
    }
    if (titles.length === 1) {
      return [{ start: 0, name: "Canción" }];
    }
    const counts = new Map<string, number>();
    for (const title of titles) {
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }
    const seen = new Map<string, number>();
    return titles.map((title, index) => {
      const total = counts.get(title) ?? 1;
      const number = (seen.get(title) ?? 0) + 1;
      seen.set(title, number);
      return {
        start: round(index * 8 * beatsPerBar),
        name: total > 1 ? `${title} ${number}` : title,
      };
    });
  }
  const segments = segmentsOf(bars, chosen.length, chosen.offset);
  return marksFrom(segments, named(segments), beatsPerBar);
}

/**
 * Una guía ya guardada que solo dice «Parte 1, 2, 3» recupera verso y coro
 * a partir de sus acordes. Si el cifrado estaba mal, hay que volver a subir el archivo.
 */
export function withNamedParts(guide: SongGuide): SongGuide {
  if (
    guide.sections.length === 0 ||
    !guide.sections.every((section) => isGenericPartName(section.name))
  ) {
    return guide;
  }
  const total = Math.max(
    0,
    ...guide.chords.map((chord) => chord.start + chord.beats),
    ...guide.sections.map((section) => section.start + section.beats),
    ...guide.melody.map((note) => note.start + note.beats),
    ...(guide.events ?? []).map((event) => event.pulse + event.span),
  );
  const marks = inferPartMarks(guide.chords, total, guide.beats_per_bar);
  const sections: GuideSection[] = marks
    .map((mark, index) => {
      const end = index + 1 < marks.length ? marks[index + 1].start : total;
      const previous = guide.sections.find(
        (section) =>
          mark.start >= section.start - 1e-6 && mark.start < section.start + section.beats - 1e-6,
      );
      return {
        name: mark.name,
        start: mark.start,
        beats: round(Math.max(0, end - mark.start)),
        strum: previous?.strum ?? guide.sections[0].strum,
      };
    })
    .filter((section) => section.beats > 0);
  return sections.length > 0 ? { ...guide, sections } : guide;
}
