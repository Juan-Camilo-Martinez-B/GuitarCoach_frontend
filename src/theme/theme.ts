export const THEME_STORAGE_KEY = "guitarcoach-theme";
export const THEME_EVENT = "guitarcoach-theme";

export const THEME_CHOICES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type ColorScheme = "light" | "dark";

export const THEME_COLORS: Record<ColorScheme, string> = {
  light: "#e6dfd4",
  dark: "#17130f",
};

export function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

export function nextTheme(current: ThemeChoice): ThemeChoice {
  if (current === "light") {
    return "dark";
  }
  if (current === "dark") {
    return "system";
  }
  return "light";
}

export function themeLabel(choice: ThemeChoice): string {
  if (choice === "dark") {
    return "Oscuro";
  }
  if (choice === "system") {
    return "Sistema";
  }
  return "Claro";
}

export function resolvedScheme(choice: ThemeChoice, systemDark: boolean): ColorScheme {
  if (choice === "dark" || (choice === "system" && systemDark)) {
    return "dark";
  }
  return "light";
}

export function readStoredTheme(storage: Pick<Storage, "getItem">): ThemeChoice {
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(raw) ? raw : "light";
  } catch {
    return "light";
  }
}

export function persistTheme(storage: Pick<Storage, "setItem">, choice: ThemeChoice): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    /* El modo sigue aplicado aunque el navegador bloquee el almacenamiento. */
  }
}

export function applyTheme(choice: ThemeChoice, systemDark: boolean): void {
  document.documentElement.dataset.theme = choice;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", THEME_COLORS[resolvedScheme(choice, systemDark)]);
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}
