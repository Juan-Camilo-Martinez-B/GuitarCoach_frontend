import { Component, useEffect, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useGuitarLoading } from "../audio/guitar/useGuitarLoading";
import { useSession } from "../store/session";
import { ThemeToggle } from "../theme/ThemeToggle";
import { AchievementToast, StreakBadge } from "../ui/Achievements";
import { Icon } from "../ui/Icon";
import { NAV_SECTIONS, sectionFor, type NavSection } from "./navigation";

class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="page">
          <section className="empty-stage">
            <h1>Esta sección no cargó</h1>
            <p className="lead">Vuelve al inicio y ábrela otra vez.</p>
            <Link className="button" to="/">
              Ir al inicio
            </Link>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

function SectionLinks({
  active,
  label,
  className,
}: {
  active: NavSection | null;
  label: string;
  className: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      {NAV_SECTIONS.map((section) => (
        <Link
          key={section.id}
          to={section.path}
          className={section.id === active?.id ? "nav-link is-active" : "nav-link"}
          aria-current={section.id === active?.id ? "true" : undefined}
        >
          <Icon name={section.icon} />
          <span>{section.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function Shell() {
  const location = useLocation();
  const token = useSession((state) => state.token);
  const setToken = useSession((state) => state.setToken);
  const guitarLoading = useGuitarLoading();
  const section = sectionFor(location.pathname);
  const sessionHere = location.pathname === "/entrar" || location.pathname === "/registro";

  // Cada pantalla empieza arriba: en un celular, la anterior pudo quedar muy abajo.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="shell" data-section={section?.id ?? "inicio"}>
      <a className="skip" href="#contenido">
        Saltar al contenido
      </a>
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="guitar" size={22} />
          </span>
          <span className="brand-name">GuitarCoach AI</span>
        </Link>
        <SectionLinks active={section} label="Principal" className="nav-main" />
        <div className="topbar-tools">
          <StreakBadge />
          <ThemeToggle />
          {token ? (
            <button type="button" className="nav-account" onClick={() => setToken(null)}>
              <Icon name="logout" size={18} />
              <span>Salir</span>
            </button>
          ) : (
            <NavLink to="/entrar" className={sessionHere ? "nav-account is-active" : "nav-account"}>
              <Icon name="user" size={18} />
              <span>Iniciar sesión</span>
            </NavLink>
          )}
        </div>
      </header>
      {section && section.pages.length > 0 ? (
        <nav className="subnav" aria-label={`Páginas de ${section.label}`}>
          {section.pages.map((page) => (
            <NavLink
              key={page.path}
              to={page.path}
              className={({ isActive }) => (isActive ? "subnav-link is-active" : "subnav-link")}
            >
              <Icon name={page.icon} size={18} />
              <span>{page.label}</span>
            </NavLink>
          ))}
        </nav>
      ) : null}
      <div id="contenido" className="stage">
        <StageBoundary key={location.pathname}>
          <Outlet />
        </StageBoundary>
      </div>
      <AchievementToast />
      {guitarLoading ? (
        <p className="guitar-loading" role="status">
          Cargando la guitarra…
        </p>
      ) : null}
      <footer className="site-footer">
        <p className="sample-credit">
          Guitarra de acero grabada: FluidR3 GM, Frank Wen, CC BY 3.0, a través de
          midi-js-soundfonts.
        </p>
      </footer>
      <SectionLinks active={section} label="Principal en celular" className="tabbar" />
    </div>
  );
}
