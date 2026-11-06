import { useEffect, useState } from "react";
import { Icon, type IconName } from "../ui/Icon";
import {
  applyTheme,
  isThemeChoice,
  nextTheme,
  persistTheme,
  readStoredTheme,
  themeLabel,
  type ThemeChoice,
} from "./theme";

const THEME_ICON: Record<ThemeChoice, IconName> = {
  light: "sun",
  dark: "moon",
  system: "auto",
};

function currentChoice(): ThemeChoice {
  if (typeof document === "undefined") {
    return "light";
  }
  const marked = document.documentElement.dataset.theme ?? null;
  if (isThemeChoice(marked)) {
    return marked;
  }
  return readStoredTheme(window.localStorage);
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(currentChoice);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const paint = () => applyTheme(choice, media.matches);
    paint();
    persistTheme(window.localStorage, choice);
    if (choice !== "system") {
      return;
    }
    media.addEventListener("change", paint);
    return () => media.removeEventListener("change", paint);
  }, [choice]);

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Tema ${themeLabel(choice)}. Cambiar entre claro, oscuro y sistema.`}
      title="Cambiar entre claro, oscuro y sistema"
      onClick={() => setChoice((current) => nextTheme(current))}
    >
      <Icon name={THEME_ICON[choice]} size={18} />
      <span>{themeLabel(choice)}</span>
    </button>
  );
}
