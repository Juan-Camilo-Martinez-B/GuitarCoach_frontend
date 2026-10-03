import { useState, type FormEvent } from "react";
import { ApiClient } from "../api/client";
import { signIn } from "../auth/signIn";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("La sesión vive en este navegador.");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await signIn(new ApiClient(apiUrl), email, password);
      setMessage("Sesión iniciada.");
    } catch {
      setMessage("No se pudo entrar.");
    }
  }

  return (
    <main>
      <h1>Entrar</h1>
      <form onSubmit={onSubmit}>
        <label>
          Correo
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>
        <label>
          Contraseña
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
          />
        </label>
        <button type="submit">Entrar</button>
      </form>
      <p role="status">{message}</p>
    </main>
  );
}
