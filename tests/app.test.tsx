import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";

describe("pantalla inicial", () => {
  it("presenta el tutor y aclara que el audio no sale del navegador", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("GuitarCoach AI");
    expect(html).toContain("El audio se queda en este navegador");
  });
});
