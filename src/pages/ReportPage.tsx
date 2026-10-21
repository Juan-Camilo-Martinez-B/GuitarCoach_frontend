import { useEffect, useState } from "react";
import { ApiClient, ApiError } from "../api/client";
import type { AttemptSummary, CoachPlan, ReportView } from "../domain/types";
import { useSession } from "../store/session";
import { ProgressChart } from "../ui/ProgressChart";
import { ReportPanel } from "../ui/ReportPanel";
import { StatusMessage } from "../ui/StatusMessage";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function ReportPage() {
  const token = useSession((state) => state.token);
  const lastAttemptId = useSession((state) => state.lastAttemptId);
  const [report, setReport] = useState<ReportView | null>(null);
  const [history, setHistory] = useState<AttemptSummary[]>([]);
  const [attemptId, setAttemptId] = useState(lastAttemptId ?? "");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"cancion" | "quiz" | "progresion">("cancion");
  const [plan, setPlan] = useState<CoachPlan | null>(null);

  useEffect(() => {
    if (lastAttemptId) {
      setAttemptId(lastAttemptId);
    }
  }, [lastAttemptId]);

  async function load() {
    if (!token) {
      setState("error");
      setMessage("Entra para ver el informe.");
      return;
    }
    setState("loading");
    try {
      const client = new ApiClient(apiUrl, fetch, token);
      const points = await client.progress();
      setHistory(points);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo cargar el progreso.");
    }
  }

  async function askCoach() {
    if (!token) {
      setState("error");
      setMessage("Entra para pedir el análisis.");
      return;
    }
    setState("loading");
    try {
      const result = await new ApiClient(apiUrl, fetch, token).coach(
        mode === "quiz" ? "quiz" : "progresion",
      );
      setPlan(result);
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo armar el análisis.");
    }
  }

  async function ask() {
    if (!token || attemptId.trim() === "") {
      setState("error");
      setMessage("Entra e indica el intento.");
      return;
    }
    setState("loading");
    try {
      const client = new ApiClient(apiUrl, fetch, token);
      setReport(await client.createReport(attemptId.trim()));
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo pedir el informe.");
    }
  }

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Después del intento</p>
        <h1>Análisis de entrenamiento</h1>
        <p className="lead">
          Elige si analizas una canción completa o si el coach arma un quiz o una progresión según
          tu curso.
        </p>
      </header>
      <div className="actions">
        <button type="button" aria-pressed={mode === "cancion"} onClick={() => setMode("cancion")}>
          Canción completa
        </button>
        <button type="button" aria-pressed={mode === "quiz"} onClick={() => setMode("quiz")}>
          Quiz del progreso
        </button>
        <button
          type="button"
          aria-pressed={mode === "progresion"}
          onClick={() => setMode("progresion")}
        >
          Progresión de acordes
        </button>
      </div>
      {mode === "cancion" ? (
        <section className="panel form-row">
          <label>
            Intento
            <input value={attemptId} onChange={(event) => setAttemptId(event.target.value)} />
          </label>
          <div className="actions">
            <button type="button" onClick={() => void ask()}>
              Pedir informe
            </button>
            <button className="button-ghost" type="button" onClick={() => void load()}>
              Actualizar
            </button>
          </div>
        </section>
      ) : (
        <section className="panel">
          <p>
            Este modo mira los módulos que ya marcaste. Con la clave de Gemini el texto lo reescribe
            el modelo. Sin la clave, el análisis local igual se puede practicar.
          </p>
          <button type="button" onClick={() => void askCoach()}>
            Pedir análisis
          </button>
        </section>
      )}
      <StatusMessage state={state} message={message} />
      <ReportPanel
        report={
          mode === "cancion" || !plan
            ? report
            : {
                id: plan.model,
                attemptId: "",
                diagnostico: plan.diagnostico,
                ejercicios: plan.ejercicios,
                planSemanal: plan.planSemanal,
                consejosTecnica: plan.consejosTecnica,
                model: plan.model,
              }
        }
      />
      <section className="panel">
        <h2>Historial</h2>
        <ul className="history">
          {history.map((attempt) => (
            <li key={attempt.id}>{attempt.accuracy}%</li>
          ))}
        </ul>
        <ProgressChart points={history} />
      </section>
    </main>
  );
}
