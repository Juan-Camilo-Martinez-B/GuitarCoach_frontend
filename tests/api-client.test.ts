import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "../src/api/client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("cliente de la API", () => {
  it("reconoce la sonda de vida", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { status: "ok" }));
    const client = new ApiClient("http://localhost:8000", fetchImpl);
    await expect(client.health()).resolves.toBe(true);
  });

  it("guarda el token que devuelve el inicio de sesión", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { access_token: "abc", token_type: "bearer" }),
    );
    const client = new ApiClient("http://localhost:8000", fetchImpl);
    await expect(client.login("ana@example.com", "secreto-largo")).resolves.toBe("abc");
  });

  it("traduce un fallo HTTP a un error de cliente", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, { code: "authentication_failed" }));
    const client = new ApiClient("http://localhost:8000", fetchImpl);
    await expect(client.login("ana@example.com", "mala")).rejects.toBeInstanceOf(ApiError);
  });
});
