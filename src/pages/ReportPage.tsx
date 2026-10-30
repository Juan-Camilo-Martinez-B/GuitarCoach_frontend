import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import type { AttemptSummary, CoachPlan, ReportView } from "../domain/types";
import { useSession } from "../store/session";
import { ProgressChart } from "../ui/ProgressChart";
import { ReportPanel } from "../ui/ReportPanel";
import { StatusMessage } from "../ui/StatusMessage";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type Mode = "intento" | "quiz" | "progresion";

const DATE = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

export function ReportPage() {
  const token = useSession((state) => state.token);
  const lastAttemptId = useSession((state) => state.lastAttemptId);
  const [report, setReport] = useState<ReportView | null>(null);
  const [history, setHistory] = useState<AttemptSummary[]>([]);
  const [chosen, setChosen] = useState<string | null>(lastAttemptId);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<Mode>("intento");
  const [plan, setPlan] = useState<CoachPlan | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setState("loading");
    try {
      setHistory(await new ApiClient(apiUrl, fetch, token).progress());
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo cargar el progreso.");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function askReport(attemptId: string) {
    setChosen(attemptId);
    setState("loading");
    try {
      setReport(await new ApiClient(apiUrl, fetch, token).createReport(attemptId));
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo pedir el informe.");
    }
  }

  async function askCoach() {
    setState("loading");
    try {
      setPlan(
        await new ApiClient(apiUrl, fetch, token).coach(mode === "quiz" ? "quiz" : "progresion"),
      );
      setState("idle");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo armar el análisis.");
    }
  }

  if (!token) {
    return (
      <main className="page">
        <header className="page-head">
          <p className="eyebrow">Después del intento</p>
          <h1>Informe</h1>
        </header>
        <section className="empty-stage">
          <p>El informe se arma con los intentos guardados en tu cuenta.</p>
          <Link className="button" to="/entrar">
            Iniciar sesión
          </Link>
        </section>
      </main>
    );
  }

  const recent = [...history].reverse();
  const shown =
    mode === "intento" || !plan
      ? report
      : {
          id: plan.model,
          attemptId: "",
          diagnostico: plan.diagnostico,
          ejercicios: plan.ejercicios,
          planSemanal: plan.planSemanal,
          consejosTecnica: plan.consejosTecnica,
          model: plan.model,
        };

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Después del intento</p>
        <h1>Informe</h1>
        <p className="lead">
          Elige un intento para que el tutor lo analice, o pide un quiz o una progresión según tu
          curso.
        </p>
      </header>
      <div className="auth-switch" role="group" aria-label="Qué analizar">
        <button type="button" aria-pressed={mode === "intento"} onClick={() => setMode("intento")}>
          Un intento
        </button>
        <button type="button" aria-pressed={mode === "quiz"} onClick={() => setMode("quiz")}>
          Quiz del curso
        </button>
        <button
          type="button"
          aria-pressed={mode === "progresion"}
          onClick={() => setMode("progresion")}
        >
          Progresión
        </button>
      </div>
      <StatusMessage state={state} message={message} />
      {mode === "intento" ? (
        <section className="panel">
          <h2>Tus intentos</h2>
          {recent.length === 0 ? (
            <div className="stack">
              <p className="hint">
                Todavía no hay intentos guardados. Toca una progresión completa en Práctica y
                ciérrala para verla aquí.
              </p>
              <Link className="button" to="/practica">
                Ir a practicar
              </Link>
            </div>
          ) : (
            <ul className="attempt-list">
              {recent.map((attempt) => (
                <li key={attempt.id} className={attempt.id === chosen ? "is-chosen" : undefined}>
                  <span className="attempt-song">{attempt.songTitle ?? "Canción"}</span>
                  <span className="attempt-date">{DATE.format(new Date(attempt.createdAt))}</span>
                  <span className="attempt-score">{Math.round(attempt.accuracy)} %</span>
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => void askReport(attempt.id)}
                  >
                    Ver informe
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="panel stack">
          <p>
            Este modo mira los módulos que ya marcaste en el curso. Con la clave de Gemini el texto
            lo escribe el modelo; sin ella, el análisis local igual sirve para practicar.
          </p>
          <button type="button" onClick={() => void askCoach()}>
            Pedir {mode === "quiz" ? "el quiz" : "la progresión"}
          </button>
        </section>
      )}
      <ReportPanel report={shown} />
      {history.length > 1 ? (
        <section className="panel">
          <h2>Tu precisión en el tiempo</h2>
          <ProgressChart points={history} />
        </section>
      ) : null}
    </main>
  );
}
