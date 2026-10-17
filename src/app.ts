import { calibrate } from './audio/listen';
import { startMic, type Mic, type MicError } from './audio/mic';
import type { Verdict } from './audio/chord';
import { TIME_SCALE } from './config';
import { loadProgress, saveProgress, type Progress } from './storage';

export interface SessionResult {
  date: string;
  changesPerMinute: number | null;
  reviewed: Record<string, Verdict>;
  bpmRaised: string[];
  partial: boolean;
  minutes: number;
  advancedPhase: boolean;
}

export interface App {
  progress: Progress;
  mic: Mic | null;
  micError: MicError | null;
  /** RMS médio do ambiente, medido na calibração. */
  noiseFloor: number;
  lastResult: SessionResult | null;
  save(): void;
  go(route: string): void;
  /** Liga e calibra o microfone na primeira chamada. Retorna null se indisponível. */
  ensureMic(): Promise<Mic | null>;
  /** Volume mínimo (RMS) para considerar que há som. */
  minRms(): number;
}

export type Screen = (root: HTMLElement, app: App) => void | (() => void);

const MIC_TIMEOUT_MS = 8000;

export function createApp(): App {
  let pending: Promise<Mic | null> | undefined;

  async function init(): Promise<Mic | null> {
    const timeout = new Promise<{ error: MicError }>((res) =>
      window.setTimeout(() => res({ error: 'denied' }), MIC_TIMEOUT_MS),
    );
    const r = await Promise.race([startMic(), timeout]);
    if ('error' in r) {
      app.micError = r.error;
      return null;
    }
    app.mic = r.mic;
    app.noiseFloor = await calibrate(r.mic, 3000 * TIME_SCALE);
    return r.mic;
  }

  const app: App = {
    progress: loadProgress(),
    mic: null,
    micError: null,
    noiseFloor: 0,
    lastResult: null,
    save() {
      saveProgress(app.progress);
    },
    go(route) {
      location.hash = '#/' + route;
    },
    ensureMic() {
      if (!app.progress.settings.micEnabled) return Promise.resolve(null);
      if (app.mic) return Promise.resolve(app.mic);
      if (app.micError) return Promise.resolve(null);
      pending ??= init();
      return pending;
    },
    minRms() {
      return Math.max(0.008, app.noiseFloor * 3) / app.progress.settings.sensitivity;
    },
  };
  return app;
}

export function micMessage(app: App): string {
  if (!app.progress.settings.micEnabled) return 'Microfone desligado nos ajustes. Use os botões manuais.';
  switch (app.micError) {
    case 'denied':
      return 'Microfone bloqueado. Libere nas permissões do navegador e recarregue, ou use os botões manuais.';
    case 'notfound':
      return 'Nenhum microfone encontrado. Use os botões manuais.';
    case 'unsupported':
      return 'Seu navegador não suporta áudio avançado. Use Chrome, Edge ou Safari atualizado.';
    default:
      return 'Microfone indisponível. Use os botões manuais.';
  }
}
