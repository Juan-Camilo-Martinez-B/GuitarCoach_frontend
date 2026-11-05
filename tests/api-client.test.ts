import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "../src/api/client";
import { useSession } from "../src/store/session";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

class FakeSocket {
  sent: string[] = [];
  private listeners = new Map<string, Array<(event: Event) => void>>();

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: Event) => void): void {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {}

  emit(type: string, event: { data?: string } = {}): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event as Event);
    }
  }
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

  it("avisa el cierre del trabajo por el socket", () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, {}));
    const client = new ApiClient("http://localhost:8000", fetchImpl, "abc");
    const sockets: FakeSocket[] = [];
    const previous = globalThis.WebSocket;
    globalThis.WebSocket = class extends FakeSocket {
      constructor(url: string) {
        super(url);
        sockets.push(this);
      }
    } as unknown as typeof WebSocket;
    const seen: Array<{ status: string; song_id: number | null }> = [];
    const stop = client.watchJob("trabajo-1", (job) => {
      seen.push({ status: job.status, song_id: job.song_id });
    });
    const socket = sockets[0];
    expect(socket.url).toBe("ws://localhost:8000/ws/jobs/trabajo-1");
    socket.emit("open");
    expect(JSON.parse(socket.sent[0] ?? "{}")).toEqual({ token: "abc" });
    socket.emit("message", {
      data: JSON.stringify({ id: "trabajo-1", status: "done", song_id: 4, error: null }),
    });
    expect(seen).toEqual([{ status: "done", song_id: 4 }]);
    expect(fetchImpl).not.toHaveBeenCalled();
    stop();
    globalThis.WebSocket = previous;
  });

  it("cierra la sesión cuando el token ya no vale", async () => {
    useSession.getState().setToken("viejo");
    const fetchImpl = vi.fn(async () => jsonResponse(401, { message: "El token no es válido." }));
    const client = new ApiClient("http://localhost:8000", fetchImpl, "viejo");
    await expect(client.listGuides()).rejects.toBeInstanceOf(ApiError);
    expect(useSession.getState().token).toBeNull();
    expect(useSession.getState().notice).toMatch(/sesión venció/);
  });

  it("traduce un fallo HTTP a un error de cliente", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, { code: "authentication_failed" }));
    const client = new ApiClient("http://localhost:8000", fetchImpl);
    await expect(client.login("ana@example.com", "mala")).rejects.toBeInstanceOf(ApiError);
  });
});
