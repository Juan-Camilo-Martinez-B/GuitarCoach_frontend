import { Link } from "react-router-dom";

const STEPS = [
  {
    href: "/afinador",
    index: "01",
    title: "Afina",
    text: "La aguja lee la cuerda en este equipo. Nada del micrófono sale del navegador.",
  },
  {
    href: "/biblioteca",
    index: "02",
    title: "Elige la carta",
    text: "Busca una canción e importa la secuencia de acordes para practicar.",
  },
  {
    href: "/practica",
    index: "03",
    title: "Toca el cambio",
    text: "Sigue el pulso, cierra el intento y pide el informe del tutor.",
  },
] as const;

export function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Estudio de guitarra</p>
        <h1>Practica con el oído, no con la partitura ajena</h1>
        <p className="lead">El audio se queda en este navegador.</p>
        <div className="actions">
          <Link className="button" to="/afinador">
            Abrir el afinador
          </Link>
          <Link className="button button-ghost" to="/biblioteca">
            Ir a la biblioteca
          </Link>
        </div>
      </section>
      <section className="setlist" aria-label="Recorrido">
        {STEPS.map((step) => (
          <Link key={step.href} className="set-card" to={step.href}>
            <span className="set-index">{step.index}</span>
            <h2>{step.title}</h2>
            <p>{step.text}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
