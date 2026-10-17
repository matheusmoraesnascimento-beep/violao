export function beatIntervalSec(bpm: number): number {
  return 60 / bpm;
}

/** Metrônomo com agendamento antecipado (lookahead) para não oscilar com o timer do JS. */
export class Metronome {
  private ctx: AudioContext | null = null;
  private timer: number | undefined;
  private nextTime = 0;
  private beat = 0;
  private bpm = 60;

  /** `beat` começa em 0 e cresce sem parar; use `beat % 4` para o tempo do compasso. */
  constructor(private readonly onBeat: (beat: number) => void) {}

  get running(): boolean {
    return this.timer !== undefined;
  }

  async start(bpm: number): Promise<void> {
    const AC: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx ??= new AC();
    await this.ctx.resume();
    this.bpm = bpm;
    this.beat = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  stop(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
  }

  private tick(): void {
    const ctx = this.ctx!;
    while (this.nextTime < ctx.currentTime + 0.1) {
      const n = this.beat;
      this.click(this.nextTime, n % 4 === 0);
      const delay = Math.max(0, (this.nextTime - ctx.currentTime) * 1000);
      window.setTimeout(() => {
        if (this.running) this.onBeat(n);
      }, delay);
      this.nextTime += beatIntervalSec(this.bpm);
      this.beat++;
    }
  }

  private click(t: number, accent: boolean): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1500 : 1000;
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.06);
  }
}
