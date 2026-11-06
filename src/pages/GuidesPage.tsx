import { useCallback, useEffect, useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import { SOURCE_LABEL, type GuideSummary } from "../domain/guide";
import { useJourney } from "../store/journey";
import { useSession } from "../store/session";
import { TAB_ACCEPT } from "../tab/tabFile";
import { Icon } from "../ui/Icon";
import { PageHeader } from "../ui/PageHeader";
import { StatusMessage } from "../ui/StatusMessage";
import { TabSources } from "../ui/TabSources";
import { Term } from "../ui/Term";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function GuidesPage() {
  const token = useSession((state) => state.token);
  const notice = useSession((state) => state.notice);
  const record = useJourney((state) => state.record);
  const navigate = useNavigate();
  const [guides, setGuides] = useState<GuideSummary[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const busy = state === "loading";

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
      record("propia");
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

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy) {
      void upload(event.dataTransfer.files[0]);
    }
  }

  const dropClasses = ["dropzone"];
  if (dragging) {
    dropClasses.push("is-over");
  }
  if (busy) {
    dropClasses.push("is-busy");
  }

  return (
    <main className="page">
      <PageHeader icon="music" eyebrow="Tu cancionero" title="Mis canciones">
        Aprende la canción que tú quieras. Sube su <Term id="tablatura">tablatura</Term> y la app te
        muestra los <Term id="acorde">acordes</Term> y el <Term id="rasgueo">rasgueo</Term>.
      </PageHeader>

      <section className="panel upload-flow" aria-label="Agregar una canción">
        <div className="upload-step">
          <span className="upload-number">1</span>
          <div className="upload-body">
            <h2>Consigue el archivo gratis</h2>
            <p>
              Necesitas un <Term id="guitar-pro">archivo Guitar Pro</Term>. Busca tu canción en uno
              de estos sitios y descárgalo.
            </p>
            <TabSources />
          </div>
        </div>

        <div className="upload-step">
          <span className="upload-number">2</span>
          <div className="upload-body">
            <h2>Súbelo aquí</h2>
            {token ? (
              <label
                className={dropClasses.join(" ")}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <Icon name="upload" size={32} />
                <strong>{busy ? "Leyendo la tablatura..." : "Elegir tablatura"}</strong>
                <span>o arrastra el archivo hasta aquí</span>
                <small>Acepta .gp3, .gp4, .gp5, .gpx y .gp. Máximo 5 MB.</small>
                <input
                  type="file"
                  accept={TAB_ACCEPT}
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void upload(file);
                  }}
                />
              </label>
            ) : (
              <div className="stack">
                <p className="note">{notice ?? "Tus guías se guardan en tu cuenta."}</p>
                <div className="actions">
                  <Link className="button" to="/entrar">
                    <Icon name="user" size={18} />
                    Iniciar sesión
                  </Link>
                  <Link className="button button-ghost" to="/entrar?alta=1">
                    Crear cuenta gratis
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="upload-step">
          <span className="upload-number">3</span>
          <div className="upload-body">
            <h2>Practícala a tu ritmo</h2>
            <p>Escúchala, baja la velocidad y repite solo la parte que te cueste.</p>
          </div>
        </div>
      </section>

      <StatusMessage state={state} message={message} />

      {token ? (
        <section className="panel">
          <h2>Tus canciones</h2>
          {guides.length === 0 ? (
            <p className="hint">Todavía no tienes canciones. Sube la primera arriba.</p>
          ) : (
            <ul className="guide-list" style={{ marginTop: "0.75rem" }}>
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
      ) : null}
    </main>
  );
}
