import { ApiClient } from "../api/client";
import { useSession } from "../store/session";

export async function signIn(client: ApiClient, email: string, password: string): Promise<void> {
  const token = await client.login(email, password);
  useSession.getState().setToken(token);
}
