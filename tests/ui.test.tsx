import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AttemptSummary, ReportView } from "../src/domain/types";
import { ProgressChart } from "../src/ui/ProgressChart";
import { ReportPanel, reportOrigin } from "../src/ui/ReportPanel";
import { StatusMessage } from "../src/ui/StatusMessage";

const report: ReportView = {
  id: "r1",
  attemptId: "a1",
  diagnostico: "El cambio a C llega tarde.",
  ejercicios: ["G a C a 60 BPM."],
  planSemanal: ["Día 1"],
  consejosTecnica: ["Prepara el dedo 1."],
  model: "tutor",
};

const points: AttemptSummary[] = [
  {
    id: "a1",
    songId: 1,
    songTitle: "Patio",
    accuracy: 40,
    avgDeltaMs: 20,
    createdAt: "2026-10-03T00:00:00Z",
  },
  {
    id: "a2",
    songId: 1,
    songTitle: "Patio",
    accuracy: 80,
    avgDeltaMs: 10,
    createdAt: "2026-10-04T00:00:00Z",
  },
];

describe("informe en pantalla", () => {
  it("muestra el diagnóstico, el error y la curva", () => {
    expect(renderToStaticMarkup(<ReportPanel report={report} />)).toContain("llega tarde");
    expect(renderToStaticMarkup(<StatusMessage state="error" message="Fallo de red" />)).toContain(
      "Fallo de red",
    );
    expect(renderToStaticMarkup(<StatusMessage state="loading" />)).toContain("Cargando");
    const chart = renderToStaticMarkup(<ProgressChart points={points} />);
    expect(chart).toContain("Última");
    expect(chart).toContain("80 %");
    expect(chart).toContain("Patio");
    expect(chart).not.toContain("NaN");
    expect(renderToStaticMarkup(<ProgressChart points={[]} />)).toContain("no hay intentos");
  });
});

describe("origen del informe", () => {
  it("avisa cuando el informe no lo escribió la IA", () => {
    expect(reportOrigin("analisis-local")).toContain("la IA no estuvo disponible");
  });

  it("atribuye a la IA el informe del tutor, el del modelo y el reutilizado", () => {
    for (const model of ["tutor", "openai/gpt-oss-120b", "cache"]) {
      expect(reportOrigin(model)).toContain("Escrito por la IA");
    }
  });
});
