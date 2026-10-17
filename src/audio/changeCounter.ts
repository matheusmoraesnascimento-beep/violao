import type { Verdict } from './chord';

/** Conta trocas limpas entre dois acordes: 2 leituras `ok` seguidas no alvo atual. */
export class ChangeCounter {
  count = 0;
  private idx = 0;
  private streak = 0;

  constructor(private readonly ids: [string, string]) {}

  get target(): string {
    return this.ids[this.idx];
  }

  /** Retorna true quando uma troca foi contada. */
  feed(verdict: Verdict): boolean {
    if (verdict !== 'ok') {
      this.streak = 0;
      return false;
    }
    this.streak++;
    if (this.streak < 2) return false;
    this.manual();
    return true;
  }

  /** Contagem manual (modo sem microfone). */
  manual(): void {
    this.count++;
    this.idx = 1 - this.idx;
    this.streak = 0;
  }
}
