import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function PageHeader({
  icon,
  eyebrow,
  title,
  children,
}: {
  icon: IconName;
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <span className="page-icon">
        <Icon name={icon} size={26} />
      </span>
      <div className="page-title">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children ? <div className="lead">{children}</div> : null}
      </div>
    </header>
  );
}

/** Una pantalla sin contenido todavía: explica qué falta y ofrece el paso que lo resuelve. */
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="empty-stage">
      <span className="empty-icon">
        <Icon name={icon} size={34} />
      </span>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}
