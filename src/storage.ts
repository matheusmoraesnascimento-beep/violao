export interface CardState {
  /** Caixa de Leitner, 0-5. */
  box: number;
  /** Dia (YYYY-MM-DD) da próxima revisão. */
  due: string;
}

export interface Settings {
  micEnabled: boolean;
  /** 0.5-2; multiplica a sensibilidade do microfone. */
  sensitivity: number;
}

export interface SessionRecord {
  date: string;
  changesPerMinute: number | null;
  minutes: number;
  partial: boolean;
}

export interface Progress {
  version: 1;
  phase: number;
  placementDone: boolean;
  cards: Record<string, CardState>;
  /** BPM atual por exercício (chave `strum:<id>` ou `song:<id>`). */
  bpm: Record<string, number>;
  /** Últimas 3 notas de acerto (0-1) por exercício. */
  attempts: Record<string, number[]>;
  bestChangesPerMinute: number;
  bestStrumBpm: number;
  tunedCount: number;
  songsCompleted: number;
  /** Chaves (`song:<id>`) das progressões distintas já concluídas. */
  completedSongs: string[];
  sessionsInPhase: number;
  streak: number;
  lastPracticeDay: string | null;
  history: SessionRecord[];
  settings: Settings;
}

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = 'violao.progress.v1';

export function defaultProgress(): Progress {
  return {
    version: 1,
    phase: 1,
    placementDone: false,
    cards: {},
    bpm: {},
    attempts: {},
    bestChangesPerMinute: 0,
    bestStrumBpm: 0,
    tunedCount: 0,
    songsCompleted: 0,
    completedSongs: [],
    sessionsInPhase: 0,
    streak: 0,
    lastPracticeDay: null,
    history: [],
    settings: { micEnabled: true, sensitivity: 1 },
  };
}

export function parseProgress(json: string): Progress {
  const o = JSON.parse(json) as Partial<Progress> | null;
  const ok =
    o !== null &&
    typeof o === 'object' &&
    o.version === 1 &&
    Number.isInteger(o.phase) &&
    o.phase! >= 1 &&
    o.phase! <= 6 &&
    typeof o.cards === 'object' &&
    o.cards !== null;
  if (!ok) throw new Error('Arquivo de progresso inválido.');
  const base = defaultProgress();
  return { ...base, ...o, settings: { ...base.settings, ...o.settings } } as Progress;
}

export function loadProgress(store: KV = localStorage): Progress {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return defaultProgress();
    try {
      return parseProgress(raw);
    } catch {
      store.setItem(KEY + '.corrupt', raw);
      return defaultProgress();
    }
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p: Progress, store: KV = localStorage): boolean {
  try {
    store.setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

/** Dia local no formato YYYY-MM-DD. */
export function todayStr(d: Date = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function parseDay(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(day: string, n: number): string {
  const dt = new Date(parseDay(day) + n * 86_400_000);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b) - parseDay(a)) / 86_400_000);
}

/** Permite um dia de descanso entre práticas sem quebrar a sequência. */
export function updateStreak(p: Progress, today: string): void {
  if (p.lastPracticeDay === today) return;
  const continues = p.lastPracticeDay !== null && daysBetween(p.lastPracticeDay, today) <= 2;
  p.streak = continues ? p.streak + 1 : 1;
  p.lastPracticeDay = today;
}
