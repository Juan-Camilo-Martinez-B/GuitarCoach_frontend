import type { ReportView } from "../domain/types";

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
      <p>{report.diagnostico}</p>
      <ReportList title="Ejercicios" items={report.ejercicios} />
      <ReportList title="Plan de la semana" items={report.planSemanal} />
      <ReportList title="Consejos de técnica" items={report.consejosTecnica} />
    </article>
  );
}
