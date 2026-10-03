export type GamePhase = "idle" | "countdown" | "playing" | "finished";

export class GameLoop {
  phase: GamePhase = "idle";
  private remainingMs = 0;

  start(countdownMs = 3000): void {
    this.phase = "countdown";
    this.remainingMs = countdownMs;
  }

  tick(deltaMs: number): void {
    if (this.phase !== "countdown") {
      return;
    }
    this.remainingMs -= deltaMs;
    if (this.remainingMs <= 0) {
      this.phase = "playing";
    }
  }

  finish(): void {
    if (this.phase === "playing") {
      this.phase = "finished";
    }
  }
}

export function practiceCommand(key: string, phase: GamePhase): "start" | "finish" | null {
  if (key === " " && phase === "idle") {
    return "start";
  }
  if (key === "Enter" && phase === "playing") {
    return "finish";
  }
  return null;
}
