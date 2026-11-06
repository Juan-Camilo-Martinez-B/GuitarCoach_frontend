import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { glossaryEntry, splitGlossary } from "../domain/glossary";

/** Una palabra técnica que se explica al tocarla, con el teclado o con el dedo. */
export function Term({ id, children }: { id: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);
  const bubbleId = useId();
  const entry = glossaryEntry(id);

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOutside = (event: PointerEvent) => {
      if (!holder.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!entry) {
    return <>{children}</>;
  }

  return (
    <span className="term" ref={holder}>
      <button
        type="button"
        className="term-word"
        aria-expanded={open}
        aria-controls={open ? bubbleId : undefined}
        onClick={(event) => {
          // Dentro de una etiqueta, el clic no debe activar también su control.
          event.preventDefault();
          setOpen((current) => !current);
        }}
      >
        {children}
      </button>
      {open ? (
        <span className="term-bubble" id={bubbleId} role="status">
          <strong>{entry.term}</strong>
          <span>{entry.meaning}</span>
          <em>{entry.example}</em>
        </span>
      ) : null}
    </span>
  );
}

/** Texto corrido cuyos términos del glosario quedan listos para tocarse. */
export function GlossaryText({ text }: { text: string }) {
  return (
    <>
      {splitGlossary(text).map((piece, index) =>
        typeof piece === "string" ? (
          piece
        ) : (
          <Term key={`${piece.id}-${index}`} id={piece.id}>
            {piece.text}
          </Term>
        ),
      )}
    </>
  );
}
