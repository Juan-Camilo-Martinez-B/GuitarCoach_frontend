// El clic no pasa por la sala ni por la caja: tiene que sonar seco y preciso.
const CLICK_LENGTH = 0.03;

export class Metronome {
  private readonly clicks = new Set<OscillatorNode>();

  constructor(
    private readonly context: BaseAudioContext,
    private readonly destination: AudioNode,
  ) {}

  /** Programa un clic; el primer tiempo del compás suena más agudo y más fuerte. */
  click(at: number, accent: boolean): void {
    const oscillator = this.context.createOscillator();
    oscillator.type = "square";
    oscillator.frequency.value = accent ? 1760 : 1320;
    const gain = this.context.createGain();
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(accent ? 0.12 : 0.07, at + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + CLICK_LENGTH);
    oscillator.connect(gain);
    gain.connect(this.destination);
    oscillator.start(at);
    oscillator.stop(at + CLICK_LENGTH + 0.01);
    this.clicks.add(oscillator);
    oscillator.onended = () => {
      this.clicks.delete(oscillator);
      gain.disconnect();
    };
  }

  stopAll(): void {
    const now = this.context.currentTime;
    for (const oscillator of this.clicks) {
      try {
        oscillator.stop(now);
      } catch {
        /* ya terminó */
      }
    }
    this.clicks.clear();
  }
}
