import { ApiClient } from "../api/client";
import { signIn } from "./signIn";

export async function signUp(
  client: ApiClient,
  email: string,
  password: string,
  displayName: string,
): Promise<void> {
  await client.register(email, password, displayName);
  await signIn(client, email, password);
}
