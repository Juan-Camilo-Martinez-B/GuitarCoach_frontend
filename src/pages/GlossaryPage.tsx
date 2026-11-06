import { useMemo, useState } from "react";
import { GLOSSARY } from "../domain/glossary";
import { Icon } from "../ui/Icon";
import { PageHeader } from "../ui/PageHeader";

function normalized(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function GlossaryPage() {
  const [query, setQuery] = useState("");
  const found = useMemo(() => {
    const wanted = normalized(query.trim());
    return GLOSSARY.filter((entry) =>
      normalized(`${entry.term} ${entry.meaning}`).includes(wanted),
    );
  }, [query]);

  return (
    <main className="page">
      <PageHeader icon="help" eyebrow="Sin palabras raras" title="Diccionario de guitarra">
        Todo lo que suena a idioma extraño, explicado con palabras simples.
      </PageHeader>
      <label className="search-field">
        <span className="visually-hidden">Buscar una palabra</span>
        <Icon name="search" />
        <input
          value={query}
          placeholder="Busca una palabra, por ejemplo: cejilla"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {found.length === 0 ? (
        <p className="note">No encontramos esa palabra. Prueba con otra.</p>
      ) : (
        <dl className="glossary-grid">
          {found.map((entry) => (
            <div key={entry.id} className="panel glossary-card">
              <dt>{entry.term}</dt>
              <dd>{entry.meaning}</dd>
              <dd className="glossary-example">{entry.example}</dd>
            </div>
          ))}
        </dl>
      )}
    </main>
  );
}
