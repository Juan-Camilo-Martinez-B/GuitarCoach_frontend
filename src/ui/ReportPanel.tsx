import type { ReportView } from "../domain/types";

export function ReportPanel({ report }: { report: ReportView | null }) {
  if (!report) {
    return <p>El diagnóstico aparece cuando el tutor termina.</p>;
  }
  return (
    <article>
      <h2>Diagnóstico</h2>
      <p>{report.diagnostico}</p>
      <h2>Ejercicios</h2>
      <ul>
        {report.ejercicios.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}
