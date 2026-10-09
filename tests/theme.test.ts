import { describe, expect, it } from "vitest";
import {
  nextTheme,
  readStoredTheme,
  resolvedScheme,
  themeLabel,
  THEME_STORAGE_KEY,
} from "../src/theme/theme";

describe("tema", () => {
  it("recorre claro, oscuro y sistema", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
    expect(nextTheme("system")).toBe("light");
    expect(themeLabel("light")).toBe("Claro");
    expect(themeLabel("dark")).toBe("Oscuro");
    expect(themeLabel("system")).toBe("Sistema");
  });

  it("usa claro si no hay una eleccion valida", () => {
    const storage = { getItem: () => "azul" };
    expect(readStoredTheme(storage)).toBe("light");
    expect(readStoredTheme({ getItem: () => "dark" })).toBe("dark");
    expect(THEME_STORAGE_KEY).toBe("guitarcoach-theme");
  });

  it("sigue al sistema solo en ese modo", () => {
    expect(resolvedScheme("light", true)).toBe("light");
    expect(resolvedScheme("dark", false)).toBe("dark");
    expect(resolvedScheme("system", true)).toBe("dark");
    expect(resolvedScheme("system", false)).toBe("light");
  });
});
