import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/api/client";
import { signIn } from "../src/auth/signIn";
import { useSession } from "../src/store/session";

describe("sesión", () => {
  it("guarda el token después de entrar", async () => {
    useSession.setState({ token: null });
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ access_token: "abc" }), { status: 200 }),
    );
    await signIn(new ApiClient("http://localhost:8000", fetchImpl), "ana@example.com", "secreto");
    expect(useSession.getState().token).toBe("abc");
  });
});
