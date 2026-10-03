import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRoutes } from "../src/App";

describe("rutas", () => {
  it("muestra el inicio dentro del marco de navegación", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(html).toContain("GuitarCoach AI");
    expect(html).toContain("El audio se queda en este navegador");
    expect(html).toContain("Afinador");
  });
});
