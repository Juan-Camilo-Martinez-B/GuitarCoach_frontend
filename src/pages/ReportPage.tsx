import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import type { AttemptSummary, CoachPlan, ReportView } from "../domain/types";
import { useJourney } from "../store/journey";
import { useSession } from "../store/session";
import { Achievements } from "../ui/Achievements";
import { Icon } from "../ui/Icon";
import { EmptyState, PageHeader } from "../ui/PageHeader";
import { ProgressChart } from "../ui/ProgressChart";
import { ReportPanel } from "../ui/ReportPanel";
import { StatusMessage } from "../ui/StatusMessage";
import { Term } from "../ui/Term";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type Mode = "intento" | "quiz" | "progresion";

const DATE = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeStyle: "short" });

export function ReportPage() {
  const token = useSession((state) => state.token);
  const lastAttemptId = useSession((state) => state.lastAttemptId);
  const record = useJourney((state) => state.record);
  const [report, setReport] = useState<ReportView | null>(null);
  const [history, setHistory] = useState<AttemptSummary[]>([]);
  const [chosen, setChosen] = useState<string | null>(lastAttemptId);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<Mode>("intento");
  const [plan, setPlan] = useState<CoachPlan | null>(null);
  const sessionAttempt = (useLocation().state as { attemptId?: string } | null)?.attemptId;
  const openedAttempt = useRef<string | null>(null);
  const reportPanel = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setState("loading");
    try {
      setHistory(await new ApiClient(apiUrl, fetch, token).progress());
      setState("idle");
      record("avance");
    } catch (error) {
      setState("error");
      setMessage(error instanceof ApiError ? error.message : "No se pudo cargar el progreso.");
    }
  }, [record, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const askReport = useCallback(
    async (attemptId: string) => {
      setChosen(attemptId);
      setState("loading");
      try {
        setReport(await new ApiClient(apiUrl, fetch, token).createReport(attemptId));
        setState("idle");
      } catch (error) {
        setState("error");
        setMessage(error instanceof ApiError ? error.message : "No se pudo pedir el informe.");
      }
    },
    [token],
  );

  // Se llega aquí al terminar una sesión: su informe se abre sin buscarlo en la lista.
  useEffect(() => {
    if (!token || !sessionAttempt || openedAttempt.current === sessionAttempt) {
      return;
    }
    openedAttempt.current = sessionAttempt;
    void askReport(sessionAttempt);
  }, [askReport, sessionAttempt, token]);

  useEffect(() => {
    if (report && report.attemptId === sessionAttempt) {
      reportPanel.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [report, sessionAttempt]);

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
        <PageHeader icon="chart" eyebrow="Después de tocar" title="Informe y logros">
          Mira cómo vas y qué te conviene practicar después.
        </PageHeader>
        <Achievements />
        <EmptyState icon="chart" title="Tu informe te espera">
          <p>El informe se arma con los intentos guardados en tu cuenta.</p>
          <Link className="button" to="/entrar">
            Iniciar sesión
          </Link>
        </EmptyState>
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
      <PageHeader icon="chart" eyebrow="Después de tocar" title="Informe y logros">
        Elige un <Term id="intento">intento</Term> y el tutor te dirá qué mejorar, o pídele un quiz
        o una <Term id="progresion">progresión</Term> según lo que ya viste en el curso.
      </PageHeader>

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
          <div className="section-head">
            <h2>Tus intentos</h2>
          </div>
          {recent.length === 0 ? (
            <div className="stack">
              <p className="hint">
                Todavía no hay intentos guardados. Toca una progresión completa en Práctica y
                ciérrala para verla aquí.
              </p>
              <div className="actions">
                <Link className="button" to="/practica">
                  <Icon name="guitar" size={18} />
                  Ir a practicar
                </Link>
              </div>
            </div>
          ) : (
            <ul className="attempt-list">
              {recent.map((attempt) => {
                const score = Math.round(attempt.accuracy);
                return (
                  <li key={attempt.id} className={attempt.id === chosen ? "is-chosen" : undefined}>
                    <span>
                      <span className="attempt-song">{attempt.songTitle ?? "Canción"}</span>
                      <span className="attempt-date">
                        {DATE.format(new Date(attempt.createdAt))}
                      </span>
                    </span>
                    <span className="attempt-score">
                      {score} %
                      <span className="score-bar" aria-hidden="true">
                        <span style={{ width: `${score}%` }} />
                      </span>
                    </span>
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => void askReport(attempt.id)}
                    >
                      Ver informe
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <section className="panel stack">
          <p>
            Este modo mira los módulos que ya marcaste en el curso y te propone qué practicar ahora.
          </p>
          <div className="actions">
            <button type="button" onClick={() => void askCoach()}>
              Pedir {mode === "quiz" ? "el quiz" : "la progresión"}
            </button>
          </div>
        </section>
      )}
      <div ref={reportPanel}>
        <ReportPanel report={shown} />
      </div>
      {history.length > 1 ? (
        <section className="panel">
          <h2>
            Tu <Term id="precision">precisión</Term> en el tiempo
          </h2>
          <ProgressChart points={history} />
        </section>
      ) : null}
      <Achievements />
    </main>
  );
}
