export function StatusMessage({
  state,
  message,
}: {
  state: "idle" | "loading" | "error";
  message?: string;
}) {
  if (state === "loading") {
    return <p role="status">Cargando…</p>;
  }
  if (state === "error") {
    return <p role="alert">{message}</p>;
  }
  return null;
}
