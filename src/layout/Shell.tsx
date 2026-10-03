import { Link, Outlet } from "react-router-dom";

const LINKS = [
  ["/", "Inicio"],
  ["/afinador", "Afinador"],
  ["/practica", "Práctica"],
  ["/biblioteca", "Biblioteca"],
  ["/informe", "Informe"],
  ["/entrar", "Entrar"],
] as const;

export function Shell() {
  return (
    <div className="shell">
      <a className="skip" href="#contenido">
        Saltar al contenido
      </a>
      <header className="topbar">
        <p className="brand">GuitarCoach AI</p>
        <nav aria-label="Principal">
          {LINKS.map(([path, label]) => (
            <Link key={path} to={path}>
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
