import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import { SOURCE_LABEL, type GuideSummary } from "../domain/guide";
import { useSession } from "../store/session";
import { TAB_ACCEPT } from "../tab/tabFile";
import { StatusMessage } from "../ui/StatusMessage";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function GuidesPage() {
  const token = useSession((state) => state.token);
  const notice = useSession((state) => state.notice);
  const navigate = useNavigate();
  const [guides, setGuides] = useState<GuideSummary[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setState("loading");
    try {
      setGuides(await new ApiClient(apiUrl, fetch, token).listGuides());
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof ApiError ? error.message : "No se pudieron cargar tus canciones.",
      );
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * La tablatura se lee en el navegador: de ahí salen los acordes, los rasgueos y las notas
   * de la guitarra. El servidor valida la guía y guarda el archivo para tocarlo nota por nota.
   */
  async function upload(file: File | undefined) {
    if (!file) {
      return;
    }
    setState("loading");
    setMessage("");
    try {
      const { readTab } = await import("../tab/readTab");
      const guide = await readTab(file);
      const created = await new ApiClient(apiUrl, fetch, token).guideFromTab(file, guide);
      navigate(`/canciones/${created.id}`);
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "No se pudo leer la tablatura.",
      );
    }
  }

  if (!token) {
    return (
      <main className="page">
        <header className="page-head">
          <p className="eyebrow">Tu cancionero</p>
          <h1>Mis canciones</h1>
          <p className="lead">
            Sube la tablatura de una canción y la app arma su guía de acordes y rasgueo.
          </p>
        </header>
        <section className="empty-stage">
          <p>{notice ?? "Tus guías se guardan en tu cuenta."}</p>
          <Link className="button" to="/entrar">
            Iniciar sesión
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Tu cancionero</p>
        <h1>Mis canciones</h1>
        <p className="lead">
          Sube la tablatura de la canción y practícala por secciones, a tu tempo.
        </p>
      </header>

      <section className="panel guide-new">
        <h2>Nueva canción</h2>
        <div className="stack">
          <p>
            Sube un archivo de <strong>Guitar Pro</strong> (.gp3, .gp4, .gp5, .gpx o .gp, de Guitar
            Pro 3 en adelante). La app toma solo la guitarra y saca de ella los acordes, los
            rasgueos y las notas reales del cover.
          </p>
          <label className="button file-button">
            {state === "loading" ? "Leyendo la tablatura..." : "Elegir tablatura"}
            <input
              type="file"
              accept={TAB_ACCEPT}
              disabled={state === "loading"}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void upload(file);
              }}
            />
          </label>
        </div>

        <details className="guide-help">
          <summary>Dónde conseguir tablaturas</summary>
          <ul>
            <li>
              En Ultimate Guitar, busca la canción y filtra por el tipo <em>Guitar Pro</em>. Con una
              cuenta gratuita se descargan las que suben otros usuarios.
            </li>
            <li>
              Songsterr tiene muy buenas transcripciones; descargarlas requiere Songsterr Plus.
            </li>
            <li>Elige la versión con más votos: la guía es tan fiel como la tablatura.</li>
          </ul>
        </details>
      </section>

      <StatusMessage state={state} message={message} />

      <section className="panel">
        <h2>Tus canciones</h2>
        {guides.length === 0 ? (
          <p className="hint">Todavía no tienes canciones. Sube la primera arriba.</p>
        ) : (
          <ul className="guide-list">
            {guides.map((guide) => (
              <li key={guide.id}>
                <Link to={`/canciones/${guide.id}`} className="guide-card">
                  <span className="guide-card-title">{guide.title}</span>
                  <span className="guide-card-meta">
                    {guide.artist} · {guide.bpm} BPM ·{" "}
                    {SOURCE_LABEL[guide.sourceKind] ?? guide.sourceKind}
                  </span>
                  <span className={`guide-status is-${guide.status}`}>
                    {guide.status === "revisada" ? "Revisada" : "Borrador"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
