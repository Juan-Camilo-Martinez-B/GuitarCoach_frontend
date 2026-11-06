import { TAB_SOURCES } from "../domain/tabSources";
import { Icon } from "./Icon";

/** A dónde ir por un archivo: son sitios externos, así que abren en otra pestaña. */
export function TabSources() {
  return (
    <div className="source-block">
      <ul className="source-grid" aria-label="Sitios con archivos gratuitos de Guitar Pro">
        {TAB_SOURCES.map((source) => (
          <li key={source.name}>
            <a className="source-card" href={source.url} target="_blank" rel="noopener noreferrer">
              <span className="source-name">
                {source.name}
                <Icon name="external" size={18} />
                <span className="visually-hidden">(abre en otra pestaña)</span>
              </span>
              <span className="source-access">{source.access}</span>
              <span>{source.text}</span>
              <small>{source.tip}</small>
            </a>
          </li>
        ))}
      </ul>
      <p className="hint">
        Son páginas externas y sus condiciones pueden cambiar. Las tablaturas las escriben otras
        personas: úsalas para tu estudio personal.
      </p>
    </div>
  );
}
