import { useState } from "react";
import { Link } from "react-router-dom";
import { JOURNEY_STEPS, nextStep } from "../domain/journey";
import { readVisit } from "../store/lastVisit";
import { useJourney } from "../store/journey";
import { Achievements } from "../ui/Achievements";
import { GuidedPath } from "../ui/GuidedPath";
import { GuitarExplorer } from "../ui/GuitarExplorer";
import { Icon } from "../ui/Icon";
import { Term } from "../ui/Term";

export function HomePage() {
  const [visit] = useState(readVisit);
  const progress = useJourney((state) => state.progress);
  const upcoming = nextStep(progress);
  const done = progress.milestones.length;

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Tu profesor de guitarra</p>
          <h1>Aprende guitarra paso a paso, aunque nunca hayas tocado</h1>
          <p className="lead">
            Escucha, imita y recibe ayuda al instante. El audio se queda en este navegador.
          </p>
          <div className="actions">
            {upcoming ? (
              <Link className="button button-large" to={upcoming.path}>
                <Icon name={upcoming.icon} />
                {done === 0 ? "Empezar: " : "Seguir: "}
                {upcoming.title.toLowerCase()}
              </Link>
            ) : (
              <Link className="button button-large" to="/canciones">
                <Icon name="music" />
                Practicar mis canciones
              </Link>
            )}
          </div>
          <p className="hint">
            ¿Ves una palabra subrayada, como <Term id="traste">traste</Term>? Tócala y te explicamos
            qué significa.
          </p>
        </div>
        <div className="hero-board">
          <h2>Prueba: esta guitarra suena</h2>
          <GuitarExplorer />
        </div>
      </section>

      {visit ? (
        <Link className="panel resume-card" to={visit.path}>
          <span className="resume-icon">
            <Icon name="play" />
          </span>
          <span>
            <span className="eyebrow">Continuar donde quedaste</span>
            <strong>{visit.label}</strong>
          </span>
          <Icon name="arrowRight" />
        </Link>
      ) : null}

      <section className="panel path-panel" aria-labelledby="ruta-titulo">
        <div className="section-head">
          <div>
            <h2 id="ruta-titulo">Tu ruta de principiante</h2>
            <p className="hint">Cinco pasos cortos. Puedes hacerlos a tu ritmo.</p>
          </div>
          <div
            className="path-meter"
            role="img"
            aria-label={`${done} de ${JOURNEY_STEPS.length} pasos completados`}
          >
            {JOURNEY_STEPS.map((step) => (
              <span
                key={step.id}
                className={progress.milestones.includes(step.id) ? "is-done" : undefined}
              />
            ))}
          </div>
        </div>
        <GuidedPath />
      </section>

      <Achievements />
    </main>
  );
}
