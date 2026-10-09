import { Link, NavLink, Outlet } from "react-router-dom";
import { ThemeToggle } from "../theme/ThemeToggle";

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
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 36 36" width="36" height="36">
              <circle cx="18" cy="18" r="16" />
              <circle cx="18" cy="18" r="6" />
              <path d="M18 2.5v6.5M18 27v6.5M2.5 18h6.5M27 18h6.5" />
            </svg>
          </span>
          <span className="brand-name">GuitarCoach AI</span>
        </Link>
        <div className="topbar-tools">
          <nav aria-label="Principal">
            {LINKS.map(([path, label]) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/"}
                className={({ isActive }) => (isActive ? "nav-link is-active" : "nav-link")}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <div className="neck" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div id="contenido" className="stage">
        <Outlet />
      </div>
    </div>
  );
}
