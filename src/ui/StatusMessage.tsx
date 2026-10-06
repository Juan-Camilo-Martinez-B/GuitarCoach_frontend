export function StatusMessage({
  state,
  message,
}: {
  state: "idle" | "loading" | "error";
  message?: string;
}) {
  if (state === "loading") {
    return (
      <p className="note" role="status">
        Cargando…
      </p>
    );
  }
  if (state === "error") {
    return (
      <p className="alert" role="alert">
        {message}
      </p>
    );
  }
  return null;
}
