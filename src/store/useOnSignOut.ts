import { useEffect, useRef } from "react";
import { useSession } from "./session";

/**
 * Avisa cuando la sesión se cierra o vence. Las páginas siguen montadas al salir, así que
 * lo que dependa de la sesión, como el micrófono, se apaga aquí y no al desmontar.
 */
export function useOnSignOut(action: () => void): void {
  const token = useSession((state) => state.token);
  const previous = useRef(token);
  const latestAction = useRef(action);
  latestAction.current = action;

  useEffect(() => {
    if (previous.current && !token) {
      latestAction.current();
    }
    previous.current = token;
  }, [token]);
}
