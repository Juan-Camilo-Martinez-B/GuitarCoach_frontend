// Comodidad por navegador: si el almacenamiento falla, el inicio simplemente no la muestra.
const KEY = "guitarcoach-last-visit";

export interface LastVisit {
  path: string;
  label: string;
}

export function rememberVisit(visit: LastVisit): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(visit));
  } catch {
    /* almacenamiento bloqueado o lleno */
  }
}

export function readVisit(): LastVisit | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<LastVisit>;
    // Solo rutas internas: nunca se navega a una dirección guardada que salga de la app.
    if (
      typeof parsed.path !== "string" ||
      !parsed.path.startsWith("/") ||
      parsed.path.startsWith("//")
    ) {
      return null;
    }
    return { path: parsed.path, label: String(parsed.label ?? "Seguir") };
  } catch {
    return null;
  }
}
