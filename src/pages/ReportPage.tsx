import { useState } from "react";
import { ApiClient } from "../api/client";
import type { AttemptSummary, ReportView } from "../domain/types";
import { useSession } from "../store/session";
import { ProgressChart } from "../ui/ProgressChart";
import { ReportPanel } from "../ui/ReportPanel";
import { StatusMessage } from "../ui/StatusMessage";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function ReportPage() {
  const token = useSession((state) => state.token);
  const [report, setReport] = useState<ReportView | null>(null);
  const [history, setHistory] = useState<AttemptSummary[]>([]);
  const [attemptId, setAttemptId] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

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
    } catch {
      setState("error");
      setMessage("No se pudo cargar el progreso.");
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
    } catch {
      setState("error");
      setMessage("No se pudo pedir el informe.");
    }
  }

  return (
    <main>
      <h1>Informe</h1>
      <label>
        Intento
        <input value={attemptId} onChange={(event) => setAttemptId(event.target.value)} />
      </label>
      <button type="button" onClick={() => void ask()}>
        Pedir informe
      </button>
      <button type="button" onClick={() => void load()}>
        Actualizar
      </button>
      <StatusMessage state={state} message={message} />
      <ReportPanel report={report} />
      <h2>Historial</h2>
      <ul>
        {history.map((attempt) => (
          <li key={attempt.id}>{attempt.accuracy}%</li>
        ))}
      </ul>
      <ProgressChart points={history} />
    </main>
  );
}
