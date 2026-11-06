import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import { spanishName } from "../chords/shapes";
import type { Song } from "../domain/types";
import { useSession } from "../store/session";
import { ChordFigure } from "../ui/ChordDiagram";
import { Icon } from "../ui/Icon";
import { PageHeader } from "../ui/PageHeader";
import { StatusMessage } from "../ui/StatusMessage";
import { Term } from "../ui/Term";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const CATALOG_QUERY = "GuitarCoach";

function uniqueChords(song: Song): string[] {
  return [...new Set(song.chords.map((chord) => chord.chord))];
}

export function LibraryPage() {
  const token = useSession((state) => state.token);
  const setSong = useSession((state) => state.setSong);
  const setStudy = useSession((state) => state.setStudy);
  const setTeachingMode = useSession((state) => state.setTeachingMode);
  const setPracticePattern = useSession((state) => state.setPracticePattern);
  const selected = useSession((state) => state.song);
  const study = useSession((state) => state.study);
  const navigate = useNavigate();
  const detail = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState<Song[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const runSearch = useCallback(async (text: string) => {
    setState("loading");
    try {
      const found = await new ApiClient(apiUrl).searchSongs(text);
      setSongs(found);
      setMessage(found.length === 0 ? "No hay canciones con ese texto en el catálogo." : "");
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo buscar.");
    }
  }, []);

  useEffect(() => {
    void runSearch(CATALOG_QUERY);
  }, [runSearch]);

  async function search(event: FormEvent) {
    event.preventDefault();
    await runSearch(query.trim() || CATALOG_QUERY);
  }

  async function select(song: Song) {
    setSong(song);
    setStudy(null);
    // En una columna, el detalle queda debajo de la lista: se acerca para no perderlo de vista.
    detail.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    try {
      setStudy(await new ApiClient(apiUrl, fetch, token).songStudy(song.id));
    } catch {
      setStudy(null);
    }
  }

  function practice() {
    if (!selected) {
      return;
    }
    setTeachingMode("acordes");
    setPracticePattern(null);
    navigate("/practica");
  }

  return (
    <main className="page">
      <PageHeader icon="library" eyebrow="Paso 2: elige qué tocar" title="Biblioteca">
        Canciones de práctica, de menor a mayor dificultad. Toca una para ver sus{" "}
        <Term id="acorde">acordes</Term>.
      </PageHeader>

      <form className="search-bar" onSubmit={(event) => void search(event)}>
        <label className="search-field">
          <span className="visually-hidden">Buscar por canción o artista</span>
          <Icon name="search" />
          <input
            value={query}
            placeholder="Busca una canción, por ejemplo: Lamento"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button type="submit">Buscar</button>
      </form>

      <StatusMessage state={state} message={message} />
      {state === "idle" && message ? <p className="hint">{message}</p> : null}

      <div className="library-layout">
        <ul className="guide-list" aria-label="Canciones">
          {songs.map((song) => (
            <li key={song.id}>
              <button
                type="button"
                className="guide-card song-card"
                aria-pressed={selected?.id === song.id}
                onClick={() => void select(song)}
              >
                <span className="guide-card-title">{song.title}</span>
                <span className="guide-card-meta">
                  {song.artist} · {song.bpm} BPM
                  {song.songKey ? ` · tono ${spanishName(song.songKey)}` : ""}
                </span>
                <span className="song-card-chords">
                  {uniqueChords(song)
                    .map((chord) => spanishName(chord))
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <section ref={detail} className="panel song-detail" aria-label="Canción elegida">
          {selected ? (
            <>
              <h2>{selected.title}</h2>
              {study ? <p className="hint">{study.summary}</p> : null}
              {study ? <p className="status-pill">Dificultad: {study.difficulty}</p> : null}
              <p className="hint">Toca un diagrama para oír el acorde.</p>
              <div className="chord-grid">
                {uniqueChords(selected).map((symbol) => (
                  <ChordFigure key={symbol} symbol={symbol} />
                ))}
              </div>
              <button type="button" className="button-large" onClick={practice}>
                <Icon name="guitar" />
                Practicar esta canción
              </button>
            </>
          ) : (
            <>
              <h2>Elige una canción</h2>
              <p className="hint">
                Aquí verás dónde poner los dedos para cada acorde, antes de empezar a tocar.
              </p>
            </>
          )}
        </section>
      </div>

      <section className="panel actions actions-split">
        <div>
          <h2>¿Quieres aprender otra canción?</h2>
          <p className="hint">
            Consigue su archivo gratis y la app arma una guía con sus acordes y su rasgueo.
          </p>
        </div>
        <Link className="button button-ghost" to="/canciones">
          Ir a mis canciones
          <Icon name="arrowRight" size={18} />
        </Link>
      </section>
    </main>
  );
}
