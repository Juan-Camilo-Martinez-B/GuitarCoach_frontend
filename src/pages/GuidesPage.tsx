import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import { SOURCE_LABEL, type GuideSummary } from "../domain/guide";
import { useSession } from "../store/session";
import { StatusMessage } from "../ui/StatusMessage";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type Mode = "pegar" | "archivo" | "audio";

const EXAMPLE = `[Intro]
G  D  Em  C

[Verso]
G              D
(la letra se puede dejar: no se guarda)
Em             C

Coro:
| Am . . . | D7 . G . | x2`;

export function GuidesPage() {
  const token = useSession((state) => state.token);
  const navigate = useNavigate();
  const [guides, setGuides] = useState<GuideSummary[]>([]);
  const [mode, setMode] = useState<Mode>("pegar");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [text, setText] = useState("");
  const [bpm, setBpm] = useState("");
  const [time, setTime] = useState("4/4");
  const [capo, setCapo] = useState("0");
  const [strum, setStrum] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [withMelody, setWithMelody] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

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

  async function paste(event: FormEvent) {
    event.preventDefault();
    setState("loading");
    setMessage("");
    try {
      const created = await new ApiClient(apiUrl, fetch, token).pasteGuide({
        title: title.trim(),
        artist: artist.trim(),
        text,
        bpm: bpm ? Number(bpm) : undefined,
        time,
        capo: Number(capo),
        strum: strum.trim() || undefined,
      });
      navigate(`/canciones/${created.id}`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo leer el texto.");
    }
  }

  async function upload(file: File | undefined) {
    if (!file) {
      return;
    }
    setState("loading");
    setMessage("");
    try {
      const created = await new ApiClient(apiUrl, fetch, token).uploadGuide(file);
      navigate(`/canciones/${created.id}`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo leer el archivo.");
    }
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!audio) {
      return;
    }
    setAnalyzing(true);
    setState("idle");
    setMessage("");
    try {
      const created = await new ApiClient(apiUrl, fetch, token).guideFromAudio(
        audio,
        title.trim(),
        artist.trim(),
        withMelody,
      );
      navigate(`/canciones/${created.id}`);
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo analizar el audio.");
    } finally {
      setAnalyzing(false);
    }
  }

  if (!token) {
    return (
      <main className="page">
        <header className="page-head">
          <p className="eyebrow">Tu cancionero</p>
          <h1>Mis canciones</h1>
          <p className="lead">
            Pega los acordes de una canción que quieras aprender y la app arma la guía.
          </p>
        </header>
        <section className="empty-stage">
          <p>Tus guías se guardan en tu cuenta.</p>
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
          Elige una canción, pega sus acordes y practícala por secciones, a tu tempo.
        </p>
      </header>

      <section className="panel guide-new">
        <h2>Nueva guía</h2>
        <div className="auth-switch" role="group" aria-label="Cómo crear la guía">
          <button type="button" aria-pressed={mode === "pegar"} onClick={() => setMode("pegar")}>
            Pegar acordes
          </button>
          <button
            type="button"
            aria-pressed={mode === "archivo"}
            onClick={() => setMode("archivo")}
          >
            Subir archivo
          </button>
          <button type="button" aria-pressed={mode === "audio"} onClick={() => setMode("audio")}>
            Desde un audio
          </button>
        </div>

        {mode === "pegar" ? (
          <form className="stack" onSubmit={(event) => void paste(event)}>
            <div className="form-grid">
              <label>
                Canción
                <input value={title} onChange={(event) => setTitle(event.target.value)} required />
              </label>
              <label>
                Artista
                <input
                  value={artist}
                  onChange={(event) => setArtist(event.target.value)}
                  required
                />
              </label>
              <label>
                Tempo (BPM)
                <input
                  type="number"
                  min={20}
                  max={300}
                  placeholder="80"
                  value={bpm}
                  onChange={(event) => setBpm(event.target.value)}
                />
              </label>
              <label>
                Compás
                <select value={time} onChange={(event) => setTime(event.target.value)}>
                  <option value="4/4">4/4</option>
                  <option value="3/4">3/4</option>
                  <option value="6/8">6/8</option>
                  <option value="2/4">2/4</option>
                </select>
              </label>
              <label>
                Cejilla
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={capo}
                  onChange={(event) => setCapo(event.target.value)}
                />
              </label>
              <label>
                Rasgueo
                <input
                  placeholder="D-DU-UDU"
                  value={strum}
                  onChange={(event) => setStrum(event.target.value)}
                />
              </label>
            </div>
            <label>
              Acordes
              <textarea
                rows={12}
                placeholder={EXAMPLE}
                value={text}
                onChange={(event) => setText(event.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={state === "loading"}>
              Crear la guía
            </button>
          </form>
        ) : mode === "archivo" ? (
          <div className="stack">
            <p>
              <strong>ChordPro</strong> (.cho, .chopro, .pro, .txt) o <strong>MusicXML</strong> sin
              comprimir (.musicxml). MuseScore exporta MusicXML desde Archivo → Exportar.
            </p>
            <label className="button file-button">
              Elegir archivo
              <input
                type="file"
                accept=".cho,.chopro,.pro,.txt,.musicxml,.xml"
                onChange={(event) => void upload(event.target.files?.[0])}
              />
            </label>
          </div>
        ) : (
          <form className="stack" onSubmit={(event) => void analyze(event)}>
            <p>
              Sube una grabación tuya (WAV, MP3, OGG o FLAC, hasta 10 MB y 6 minutos). La app
              detecta el pulso y los acordes y arma un borrador para que lo corrijas. Funciona mejor
              con guitarra sola que con la canción completa mezclada. El audio no se guarda: se
              borra al terminar el análisis.
            </p>
            <div className="form-grid">
              <label>
                Canción
                <input value={title} onChange={(event) => setTitle(event.target.value)} required />
              </label>
              <label>
                Artista
                <input
                  value={artist}
                  onChange={(event) => setArtist(event.target.value)}
                  required
                />
              </label>
            </div>
            <label className="button file-button">
              {audio ? `Audio: ${audio.name}` : "Elegir audio"}
              <input
                type="file"
                accept="audio/wav,audio/mpeg,audio/ogg,audio/flac,.wav,.mp3,.ogg,.flac"
                onChange={(event) => setAudio(event.target.files?.[0] ?? null)}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={withMelody}
                onChange={(event) => setWithMelody(event.target.checked)}
              />
              Es una melodía o un punteo de una sola voz: detectar también las notas
            </label>
            {analyzing ? (
              <p className="note" role="status">
                Analizando el audio. Puede tardar hasta un minuto.
              </p>
            ) : null}
            <button type="submit" disabled={!audio || analyzing}>
              Analizar y crear la guía
            </button>
          </form>
        )}

        <details className="guide-help">
          <summary>Dónde conseguir los acordes y cómo escribirlos</summary>
          <ul>
            <li>
              Copia los acordes de un cancionero como LaCuerda.net, Cifra Club o Ultimate Guitar y
              pégalos aquí, para tu práctica personal. La letra no se guarda.
            </li>
            <li>Cada acorde suelto vale un compás. Una línea que termina en x2 se repite.</li>
            <li>
              Con barras, cada tramo es un compás: <code>| D7 . G . |</code> son dos acordes de dos
              tiempos. <code>%</code> repite el compás anterior.
            </li>
            <li>
              Las secciones se marcan con <code>[Intro]</code>, <code>Coro:</code> o{" "}
              <code>[Verso 1]</code>.
            </li>
            <li>
              El rasgueo va en casilleros: <code>D-DU-UDU</code> son ocho corcheas (D abajo, U
              arriba, X apagado, - silencio).
            </li>
          </ul>
        </details>
      </section>

      <StatusMessage state={state} message={message} />

      <section className="panel">
        <h2>Tus guías</h2>
        {guides.length === 0 ? (
          <p className="hint">Todavía no tienes guías. Crea la primera arriba.</p>
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
