import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import { spanishName } from "../chords/shapes";
import type { Song, SongStudy } from "../domain/types";
import { useSession } from "../store/session";
import { StatusMessage } from "../ui/StatusMessage";

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
  const navigate = useNavigate();
  const [study, setLocalStudy] = useState<SongStudy | null>(null);
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
    try {
      const loaded = await new ApiClient(apiUrl, fetch, token).songStudy(song.id);
      setStudy(loaded);
      setLocalStudy(loaded);
    } catch {
      setStudy(null);
      setLocalStudy(null);
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
      <header className="page-head">
        <p className="eyebrow">Cancionero</p>
        <h1>Biblioteca</h1>
        <p className="lead">
          Canciones de práctica listas para tocar, de menor a mayor dificultad.
        </p>
      </header>
      <form className="panel search-bar" onSubmit={(event) => void search(event)}>
        <label>
          Buscar por canción o artista
          <input
            value={query}
            placeholder="Por ejemplo: Lamento"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="actions">
          <button type="submit">Buscar</button>
        </div>
      </form>
      <StatusMessage state={state} message={message} />
      {state === "idle" && message ? <p className="hint">{message}</p> : null}
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
      {selected && study ? (
        <section className="panel">
          <h2>{selected.title}</h2>
          <p>{study.summary}</p>
          <p>Dificultad: {study.difficulty}</p>
          <div className="actions">
            <button type="button" onClick={practice}>
              Practicar esta canción
            </button>
          </div>
        </section>
      ) : null}
      <section className="panel guide">
        <h2>¿Quieres aprender otra canción?</h2>
        <p>
          En Mis canciones pegas los acordes de la canción que elijas, o subes un ChordPro o
          MusicXML, y la app arma una guía por secciones con su rasgueo.
        </p>
        <Link className="button" to="/canciones">
          Ir a mis canciones
        </Link>
      </section>
    </main>
  );
}
