import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import { pollJob } from "../api/songs";
import type { Song, SongStudy } from "../domain/types";
import { useSession } from "../store/session";
import { StatusMessage } from "../ui/StatusMessage";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function LibraryPage() {
  const token = useSession((state) => state.token);
  const setSong = useSession((state) => state.setSong);
  const setStudy = useSession((state) => state.setStudy);
  const setTeachingMode = useSession((state) => state.setTeachingMode);
  const setPracticePattern = useSession((state) => state.setPracticePattern);
  const selected = useSession((state) => state.song);
  const navigate = useNavigate();
  const [study, setLocalStudy] = useState<SongStudy | null>(null);
  const [query, setQuery] = useState("GuitarCoach");
  const [songs, setSongs] = useState<Song[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const runSearch = useCallback(
    async (text: string) => {
      setState("loading");
      try {
        const found = await new ApiClient(apiUrl).searchSongs(text);
        setSongs(found);
        if (found[0]) {
          setSong(found[0]);
        }
        setMessage(found.length === 0 ? "No hay cartas con ese texto." : "");
        setState("idle");
      } catch (error) {
        setState("error");
        setMessage(error instanceof ApiError ? error.message : "No se pudo buscar.");
      }
    },
    [setSong],
  );

  useEffect(() => {
    void runSearch("GuitarCoach");
  }, [runSearch]);

  async function search(event: FormEvent) {
    event.preventDefault();
    await runSearch(query);
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

  function teach() {
    if (!selected) {
      return;
    }
    setTeachingMode("acordes");
    setPracticePattern(null);
    navigate("/practica");
  }

  async function importChart() {
    setState("loading");
    try {
      const client = new ApiClient(apiUrl);
      const created = await client.importSong(query);
      const status = await pollJob(
        () => client.job(created.id),
        () => Promise.resolve(),
      );
      setMessage(status === "done" ? "Importación lista." : "La importación no terminó.");
      setState(status === "failed" ? "error" : "idle");
      if (status === "done") {
        await runSearch(query);
      }
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo importar.");
    }
  }

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Cancionero</p>
        <h1>Biblioteca</h1>
        <p className="lead">Sube una carta en texto o MusicXML. El análisis arma la progresión.</p>
      </header>
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
      <form className="panel search-bar" onSubmit={(event) => void search(event)}>
        <label>
          Canción
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="actions">
          <button type="submit">Buscar</button>
          <button className="button-ghost" type="button" onClick={() => void importChart()}>
            Importar
          </button>
        </div>
      </form>
      <StatusMessage state={state} message={message} />
      <ul className="songs">
        {songs.map((song) => (
          <li key={song.id}>
            <button type="button" onClick={() => void select(song)}>
              {song.title}
              {selected?.id === song.id ? " · elegida" : ""}
            </button>
          </li>
        ))}
      </ul>
      {study ? (
        <section className="panel">
          <h2>Análisis</h2>
          <p>{study.summary}</p>
          <p>Dificultad: {study.difficulty}</p>
          <div className="actions">
            <button type="button" onClick={teach}>
              Practicar acordes
            </button>
          </div>
        </section>
      ) : null}
      <p className="hint">{message}</p>
    </main>
  );
}
