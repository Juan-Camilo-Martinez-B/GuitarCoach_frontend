import { Link } from "react-router-dom";

const OPTIONS = [
  {
    href: "/aprendizaje",
    index: "01",
    title: "Aprendizaje",
    text: "Cuerdas, trastes, notas y tres canciones cortas. El avance se guarda con tu sesión.",
  },
  {
    href: "/afinador",
    index: "02",
    title: "Afinador",
    text: "La aguja lee la cuerda en este equipo. Nada del micrófono sale del navegador.",
  },
  {
    href: "/practica",
    index: "03",
    title: "Práctica",
    text: "Sigue el pulso, cierra el intento y deja el registro para el informe.",
  },
  {
    href: "/biblioteca",
    index: "04",
    title: "Biblioteca",
    text: "Busca una carta o sube ChordPro, texto o MusicXML para estudiarla.",
  },
  {
    href: "/informe",
    index: "05",
    title: "Informe",
    text: "Elige canción completa, quiz o progresión según lo que ya practicaste.",
  },
] as const;

export function HomePage() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Estudio de guitarra</p>
        <h1>Practica con el oído, no con la partitura ajena</h1>
        <p className="lead">El audio se queda en este navegador.</p>
      </section>
      <section className="setlist" aria-label="Opciones">
        {OPTIONS.map((option) => (
          <Link key={option.href} className="set-card" to={option.href}>
            <span className="set-index">{option.index}</span>
            <h2>{option.title}</h2>
            <p>{option.text}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
