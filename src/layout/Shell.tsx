import { Component, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useGuitarLoading } from "../audio/guitar/useGuitarLoading";
import { useSession } from "../store/session";
import { ThemeToggle } from "../theme/ThemeToggle";

const LINKS = [
  ["/", "Inicio"],
  ["/afinador", "Afinador"],
  ["/aprendizaje", "Aprendizaje"],
  ["/practica", "Práctica"],
  ["/biblioteca", "Biblioteca"],
  ["/informe", "Informe"],
] as const;

class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="page">
          <header className="page-head">
            <h1>Esta sección no cargó</h1>
            <p className="lead">Vuelve al inicio y ábrela otra vez.</p>
          </header>
        </main>
      );
    }
    return this.props.children;
  }
}

export function Shell() {
  const location = useLocation();
  const token = useSession((state) => state.token);
  const setToken = useSession((state) => state.setToken);
  const [menuOpen, setMenuOpen] = useState(false);
  const guitarLoading = useGuitarLoading();
  const sessionHere = location.pathname === "/entrar" || location.pathname === "/registro";

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="shell">
      <a className="skip" href="#contenido">
        Saltar al contenido
      </a>
      <header className={menuOpen ? "topbar is-open" : "topbar"}>
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
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="menu-principal"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "Cerrar" : "Menú"}
          </button>
          <nav id="menu-principal" aria-label="Principal" className="nav-main">
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
          {token ? (
            <button type="button" className="nav-link nav-account" onClick={() => setToken(null)}>
              Salir
            </button>
          ) : (
            <NavLink
              to="/entrar"
              className={sessionHere ? "nav-link nav-account is-active" : "nav-link nav-account"}
            >
              Iniciar sesión
            </NavLink>
          )}
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
        <StageBoundary key={location.pathname}>
          <Outlet />
        </StageBoundary>
      </div>
      {guitarLoading ? (
        <p className="guitar-loading" role="status">
          Cargando la guitarra…
        </p>
      ) : null}
      <p className="sample-credit">
        Guitarra de acero grabada: FluidR3 GM, Frank Wen, CC BY 3.0, a través de midi-js-soundfonts.
      </p>
    </div>
  );
}
