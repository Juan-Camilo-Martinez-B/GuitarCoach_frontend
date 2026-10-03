export class ClockService {
  private startedAt: number | null = null;
  private accumulated = 0;

  constructor(private readonly now: () => number) {}

  start(): void {
    if (this.startedAt === null) {
      this.startedAt = this.now();
    }
  }

  pause(): void {
    if (this.startedAt === null) {
      return;
    }
    this.accumulated += this.now() - this.startedAt;
    this.startedAt = null;
  }

  elapsedMs(): number {
    const running = this.startedAt === null ? 0 : this.now() - this.startedAt;
    return this.accumulated + running;
  }

  beat(bpm: number, latencyOffsetMs = 0): number {
    const elapsed = Math.max(0, this.elapsedMs() - latencyOffsetMs);
    return (elapsed / 60_000) * bpm;
  }
}
