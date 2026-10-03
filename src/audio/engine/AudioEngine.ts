export type EngineState = "idle" | "listening" | "denied" | "error";

export interface Microphone {
  request(): Promise<void>;
}

export function tunerStatusLabel(state: EngineState): string {
  if (state === "listening") {
    return "Escuchando";
  }
  if (state === "denied") {
    return "Permiso de micrófono denegado";
  }
  if (state === "error") {
    return "No se pudo abrir el audio";
  }
  return "Micrófono en espera";
}

export class AudioEngine {
  state: EngineState = "idle";

  constructor(private readonly microphone: Microphone) {}

  async start(): Promise<void> {
    try {
      await this.microphone.request();
      this.state = "listening";
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      this.state = name === "NotAllowedError" ? "denied" : "error";
    }
  }

  stop(): void {
    this.state = "idle";
  }
}
