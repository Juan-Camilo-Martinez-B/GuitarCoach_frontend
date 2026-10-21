import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiClient, ApiError } from "../api/client";
import { signIn } from "../auth/signIn";
import { signUp } from "../auth/signUp";
import { useSession } from "../store/session";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function AuthPage() {
  const token = useSession((state) => state.token);
  const setToken = useSession((state) => state.setToken);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mode = params.get("alta") === "1" ? "alta" : "entrar";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  function choose(next: "entrar" | "alta") {
    setMessage("");
    setParams(next === "alta" ? { alta: "1" } : {});
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const client = new ApiClient(apiUrl);
      if (mode === "alta") {
        await signUp(client, email, password, name);
      } else {
        await signIn(client, email, password);
      }
      navigate("/aprendizaje");
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : mode === "alta"
            ? "No se pudo crear la cuenta."
            : "No se pudo entrar.",
      );
    }
  }

  if (token) {
    return (
      <main className="page page-narrow">
        <section className="panel auth-card">
          <p className="eyebrow">Acceso</p>
          <h1>Sesión abierta</h1>
          <p className="lead">Ya puedes seguir el curso y guardar el avance.</p>
          <div className="actions">
            <Link className="button" to="/aprendizaje">
              Ir al curso
            </Link>
            <button type="button" className="button-ghost" onClick={() => setToken(null)}>
              Salir
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page page-narrow">
      <section className="panel auth-card">
        <p className="eyebrow">Acceso</p>
        <h1>{mode === "alta" ? "Crear cuenta" : "Iniciar sesión"}</h1>
        <div className="auth-switch" role="tablist" aria-label="Elegir acceso">
          <button
            type="button"
            role="tab"
            aria-pressed={mode === "entrar"}
            onClick={() => choose("entrar")}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-pressed={mode === "alta"}
            onClick={() => choose("alta")}
          >
            Crear cuenta
          </button>
        </div>
        <form className="stack" onSubmit={onSubmit}>
          {mode === "alta" ? (
            <label>
              Nombre
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
          ) : null}
          <label>
            Correo
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
            />
          </label>
          <label>
            Contraseña
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              minLength={mode === "alta" ? 8 : undefined}
              required
            />
          </label>
          <button type="submit">{mode === "alta" ? "Crear cuenta" : "Entrar"}</button>
        </form>
        {message ? (
          <p className="status-pill" role="status">
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
