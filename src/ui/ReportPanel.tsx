import type { ReportView } from "../domain/types";

const LOCAL_MODEL = "analisis-local";

/** Dice quién escribió el informe: sin esto, el análisis local parecería de la IA. */
export function reportOrigin(model: string): string {
  return model === LOCAL_MODEL
    ? "Análisis automático de la app: la IA no estuvo disponible."
    : "Escrito por la IA a partir de los datos de tu práctica.";
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <>
      <h2>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </>
  );
}

export function ReportPanel({ report }: { report: ReportView | null }) {
  if (!report) {
    return <p className="note">Aquí aparecerá el diagnóstico cuando pidas un informe.</p>;
  }
  return (
    <article className="panel report">
      <h2>Diagnóstico</h2>
      <p className="hint">{reportOrigin(report.model)}</p>
      <p>{report.diagnostico}</p>
      <ReportList title="Ejercicios" items={report.ejercicios} />
      <ReportList title="Plan de la semana" items={report.planSemanal} />
      <ReportList title="Consejos de técnica" items={report.consejosTecnica} />
    </article>
  );
}
