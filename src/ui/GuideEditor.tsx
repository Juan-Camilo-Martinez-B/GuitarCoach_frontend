import { useState } from "react";
import { isChordSymbol } from "../domain/chart";
import {
  appendSection,
  barsFromText,
  barsToText,
  removeSection,
  replaceSectionChords,
  retileSection,
  strumFromText,
  strumToText,
  type GuideStatus,
  type SongGuide,
} from "../domain/guide";
import { Term } from "./Term";

interface SectionDraft {
  name: string;
  bars: string;
  strum: string;
}

function draftsOf(guide: SongGuide): SectionDraft[] {
  return guide.sections.map((section) => ({
    name: section.name,
    bars: barsToText(guide, section),
    strum: strumToText(section.strum),
  }));
}

/** Aplica los textos de cada sección en orden: si una cambia de largo, corre a las siguientes. */
export function applyDrafts(guide: SongGuide, drafts: SectionDraft[]): SongGuide {
  let next = guide;
  const original = draftsOf(guide);
  drafts.forEach((draft, index) => {
    const section = next.sections[index];
    const label = draft.name.trim() || `Sección ${index + 1}`;
    try {
      const { chords, beats } = barsFromText(
        draft.bars,
        section.start,
        next.beats_per_bar,
        isChordSymbol,
      );
      next = replaceSectionChords(next, index, chords, beats);
      const strum = strumFromText(draft.strum, next.beats_per_bar);
      next = {
        ...next,
        sections: next.sections.map((item, position) =>
          position === index ? { ...item, name: label, strum } : item,
        ),
      };
      if (draft.strum.trim() !== original[index].strum || draft.bars !== original[index].bars) {
        next = retileSection(next, index, draft.strum);
      }
    } catch (error) {
      throw new Error(`${label}: ${error instanceof Error ? error.message : "no se pudo leer."}`);
    }
  });
  return next;
}

export function GuideEditor({
  guide,
  saving,
  onSave,
  onCancel,
}: {
  guide: SongGuide;
  saving: boolean;
  onSave: (guide: SongGuide, status: GuideStatus) => void;
  onCancel: () => void;
}) {
  const [base, setBase] = useState(guide);
  const [drafts, setDrafts] = useState(() => draftsOf(guide));
  const [title, setTitle] = useState(guide.title);
  const [artist, setArtist] = useState(guide.artist);
  const [bpm, setBpm] = useState(String(guide.bpm));
  const [capo, setCapo] = useState(String(guide.capo));
  const [error, setError] = useState("");

  function edit(index: number, field: keyof SectionDraft, value: string) {
    setDrafts((current) =>
      current.map((draft, position) => (position === index ? { ...draft, [field]: value } : draft)),
    );
  }

  function reshape(change: (applied: SongGuide) => SongGuide) {
    try {
      const next = change(applyDrafts(base, drafts));
      setBase(next);
      setDrafts(draftsOf(next));
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo cambiar la guía.");
    }
  }

  function save(status: GuideStatus) {
    try {
      const applied = applyDrafts(base, drafts);
      const tempo = Number(bpm);
      if (!Number.isInteger(tempo) || tempo < 20 || tempo > 300) {
        throw new Error("El tempo va de 20 a 300 BPM.");
      }
      setError("");
      onSave(
        {
          ...applied,
          title: title.trim(),
          artist: artist.trim(),
          bpm: tempo,
          capo: Math.min(12, Math.max(0, Math.round(Number(capo) || 0))),
        },
        status,
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Revisa la guía.");
    }
  }

  return (
    <section className="panel guide-editor" aria-label="Editor de la guía">
      <h2>Corregir la guía</h2>
      <p className="hint">
        Solo hace falta si un acorde no te suena bien. Cada tramo entre | es un compás de{" "}
        {base.beats_per_bar} tiempos y un punto alarga el acorde anterior: <code>| D7 . G . |</code>
        . En el rasgueo, D es abajo, U arriba, X apagado y - silencio.
      </p>
      <div className="form-grid">
        <label>
          Canción
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          Artista
          <input value={artist} onChange={(event) => setArtist(event.target.value)} />
        </label>
        <label>
          <span>
            <Term id="tempo">Tempo</Term> (<Term id="bpm">BPM</Term>)
          </span>
          <input
            type="number"
            min={20}
            max={300}
            value={bpm}
            onChange={(event) => setBpm(event.target.value)}
          />
        </label>
        <label>
          <span>
            <Term id="cejilla">Cejilla</Term>
          </span>
          <input
            type="number"
            min={0}
            max={12}
            value={capo}
            onChange={(event) => setCapo(event.target.value)}
          />
        </label>
      </div>
      <ol className="section-drafts">
        {drafts.map((draft, index) => (
          <li key={index}>
            <div className="section-draft-head">
              <label>
                Sección
                <input
                  value={draft.name}
                  onChange={(event) => edit(index, "name", event.target.value)}
                />
              </label>
              <label>
                Rasgueo
                <input
                  value={draft.strum}
                  onChange={(event) => edit(index, "strum", event.target.value)}
                />
              </label>
              <button
                type="button"
                className="button-ghost"
                disabled={drafts.length <= 1}
                onClick={() => reshape((applied) => removeSection(applied, index))}
              >
                Quitar
              </button>
            </div>
            <label>
              Compases
              <input
                className="bars-input"
                value={draft.bars}
                onChange={(event) => edit(index, "bars", event.target.value)}
              />
            </label>
          </li>
        ))}
      </ol>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <div className="actions">
        <button
          type="button"
          className="button-ghost"
          onClick={() =>
            reshape((applied) => appendSection(applied, `Sección ${drafts.length + 1}`))
          }
        >
          Agregar sección
        </button>
        <button type="button" disabled={saving} onClick={() => save("revisada")}>
          Guardar como revisada
        </button>
        <button
          type="button"
          className="button-ghost"
          disabled={saving}
          onClick={() => save("borrador")}
        >
          Guardar borrador
        </button>
        <button type="button" className="button-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
