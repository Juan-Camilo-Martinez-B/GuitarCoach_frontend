import { useState, type FormEvent } from "react";
import { ApiClient } from "../api/client";
import { pollJob } from "../api/songs";
import { useSession } from "../store/session";
import { StatusMessage } from "../ui/StatusMessage";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function LibraryPage() {
  const setSong = useSession((state) => state.setSong);
  const [query, setQuery] = useState("");
  const [titles, setTitles] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function search(event: FormEvent) {
    event.preventDefault();
    setState("loading");
    try {
      const songs = await new ApiClient(apiUrl).searchSongs(query);
      setTitles(songs.map((song) => song.title));
      if (songs[0]) {
        setSong(songs[0]);
      }
      setState("idle");
    } catch {
      setState("error");
      setMessage("No se pudo buscar.");
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
    } catch {
      setState("error");
      setMessage("No se pudo importar.");
    }
  }

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Cancionero</p>
        <h1>Biblioteca</h1>
        <p className="lead">Busca por título o trae una carta nueva.</p>
      </header>
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
        {titles.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>
      <p className="hint">{message}</p>
    </main>
  );
}
