import type { IconName } from "../ui/Icon";

export interface NavPage {
  path: string;
  label: string;
  icon: IconName;
}

export interface NavSection {
  id: "inicio" | "aprender" | "practicar" | "progreso";
  label: string;
  icon: IconName;
  /** A dónde lleva la sección al pulsarla: su primer paso natural. */
  path: string;
  pages: NavPage[];
}

export const NAV_SECTIONS: NavSection[] = [
  { id: "inicio", label: "Inicio", icon: "home", path: "/", pages: [] },
  {
    id: "aprender",
    label: "Aprender",
    icon: "book",
    path: "/aprendizaje",
    pages: [
      { path: "/aprendizaje", label: "Curso paso a paso", icon: "book" },
      { path: "/glosario", label: "Diccionario", icon: "help" },
    ],
  },
  {
    id: "practicar",
    label: "Practicar",
    icon: "guitar",
    path: "/biblioteca",
    pages: [
      { path: "/afinador", label: "Afinador", icon: "tuner" },
      { path: "/biblioteca", label: "Biblioteca", icon: "library" },
      { path: "/practica", label: "Práctica", icon: "mic" },
    ],
  },
  {
    id: "progreso",
    label: "Mi progreso",
    icon: "chart",
    path: "/canciones",
    pages: [
      { path: "/canciones", label: "Mis canciones", icon: "music" },
      { path: "/informe", label: "Informe y logros", icon: "chart" },
    ],
  },
];

function isInside(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** La sección a la que pertenece una ruta; las rutas sueltas, como el acceso, no tienen. */
export function sectionFor(pathname: string): NavSection | null {
  if (pathname === "/") {
    return NAV_SECTIONS[0];
  }
  return (
    NAV_SECTIONS.find((section) => section.pages.some((page) => isInside(pathname, page.path))) ??
    null
  );
}
