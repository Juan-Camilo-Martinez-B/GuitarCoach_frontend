import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import { pollJob } from "../api/songs";
import type { Song, SongStudy } from "../domain/types";
import { useSession, type TeachingMode } from "../store/session";
import { StatusMessage } from "../ui/StatusMessage";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function LibraryPage() {
  const token = useSession((state) => state.token);
  const setSong = useSession((state) => state.setSong);
  const setStudy = useSession((state) => state.setStudy);
  const setTeachingMode = useSession((state) => state.setTeachingMode);
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

  function teach(mode: TeachingMode) {
    if (!selected) {
      return;
    }
    setTeachingMode(mode);
    navigate("/practica");
  }

  async function upload(file: File | undefined) {
    if (!file) {
      return;
    }
    if (!token) {
      setState("error");
      setMessage("Entra para guardar la canción importada.");
      return;
    }
    setState("loading");
    try {
      const result = await new ApiClient(apiUrl, fetch, token).uploadSong(file);
      setSong(result.song);
      setStudy(result.study);
      setLocalStudy(result.study);
      setSongs((current) => [result.song, ...current.filter((item) => item.id !== result.song.id)]);
      setMessage(result.study.summary);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo leer el archivo.");
    }
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
        <p className="lead">
          Sube una carta en texto o MusicXML. El análisis arma acordes y notas.
        </p>
      </header>
      <section className="panel guide">
        <h2>Qué archivo subir</h2>
        <ul>
          <li>
            <strong>ChordPro</strong> (.cho, .chopro, .pro). Es un texto con acordes entre
            corchetes. Se escribe a mano o se exporta desde un editor ChordPro en chordpro.org.
          </li>
          <li>
            <strong>Texto</strong> (.txt) con líneas title, artist, bpm y key, y los acordes entre
            corchetes. Una línea melody: E D C G agrega las notas del canto.
          </li>
          <li>
            <strong>MusicXML</strong> (.musicxml, .xml) sin comprimir. En MuseScore: Archivo,
            Exportar, MusicXML. Sirve para partituras propias o de dominio público, por ejemplo las
            de imslp.org.
          </li>
        </ul>
        <p>
          No uses tablaturas descargadas de sitios de pago: el archivo tiene que ser tuyo o libre.
        </p>
        <label className="button">
          Subir carta
          <input
            type="file"
            accept=".cho,.chopro,.pro,.txt,.musicxml,.xml"
            onChange={(event) => void upload(event.target.files?.[0])}
          />
        </label>
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
            <button type="button" onClick={() => teach("acordes")}>
              Enseñar con acordes y rasgueo
            </button>
            <button className="button-ghost" type="button" onClick={() => teach("notas")}>
              Enseñar con notas del canto
            </button>
          </div>
        </section>
      ) : null}
      <p className="hint">{message}</p>
    </main>
  );
}
