export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type FetchLike = typeof fetch;

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = fetch,
    private token: string | null = null,
  ) {}

  setToken(token: string | null): void {
    this.token = token;
  }

  async health(): Promise<boolean> {
    const response = await this.fetchImpl(this.url("/health"));
    if (!response.ok) {
      return false;
    }
    const body = (await response.json()) as { status?: string };
    return body.status === "ok";
  }

  async login(email: string, password: string): Promise<string> {
    const response = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const body = (await response.json()) as { access_token: string };
    this.token = body.access_token;
    return body.access_token;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (this.token) {
      headers.set("Authorization", `Bearer ${this.token}`);
    }
    const response = await this.fetchImpl(this.url(path), { ...init, headers });
    if (!response.ok) {
      throw new ApiError(response.status, `La API respondió ${response.status}.`);
    }
    return response;
  }
}
