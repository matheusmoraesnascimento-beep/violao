import { CHORDS } from './chords';

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

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const safeKey = (k: string) => k !== '__proto__';

function count(v: unknown, fallback: number): number {
  return isNum(v) && v >= 0 ? Math.floor(v) : fallback;
}

function sanitizeCards(v: unknown): Record<string, CardState> {
  const out: Record<string, CardState> = {};
  if (!isObj(v)) return out;
  for (const [id, c] of Object.entries(v)) {
    if (!Object.hasOwn(CHORDS, id) || !isObj(c) || !isNum(c.box) || typeof c.due !== 'string' || !DAY_RE.test(c.due)) continue;
    out[id] = { box: Math.min(5, Math.max(0, Math.floor(c.box))), due: c.due };
  }
  return out;
}

function sanitizeHistory(v: unknown): SessionRecord[] {
  if (!Array.isArray(v)) return [];
  const out: SessionRecord[] = [];
  for (const r of v) {
    if (!isObj(r) || typeof r.date !== 'string' || !isNum(r.minutes)) continue;
    if (r.changesPerMinute !== null && !isNum(r.changesPerMinute)) continue;
    out.push({ date: r.date, changesPerMinute: r.changesPerMinute, minutes: r.minutes, partial: r.partial === true });
  }
  return out.slice(-60);
}

/** Valida e normaliza um JSON de progresso (importação ou localStorage). Lança se for inválido. */
export function parseProgress(json: string): Progress {
  const o = JSON.parse(json) as Record<string, unknown> | null;
  const ok =
    isObj(o) &&
    o.version === 1 &&
    Number.isInteger(o.phase) &&
    (o.phase as number) >= 1 &&
    (o.phase as number) <= 6 &&
    isObj(o.cards);
  if (!ok) throw new Error('Arquivo de progresso inválido.');
  const base = defaultProgress();
  const bpm: Record<string, number> = {};
  if (isObj(o.bpm)) for (const [k, v] of Object.entries(o.bpm)) if (safeKey(k) && isNum(v)) bpm[k] = v;
  const attempts: Record<string, number[]> = {};
  if (isObj(o.attempts)) {
    for (const [k, v] of Object.entries(o.attempts)) {
      if (safeKey(k) && Array.isArray(v)) attempts[k] = v.filter(isNum).slice(-3);
    }
  }
  const st = isObj(o.settings) ? o.settings : {};
  const sensitivity = isNum(st.sensitivity) ? Math.min(2, Math.max(0.5, st.sensitivity)) : base.settings.sensitivity;
  const completedSongs = Array.isArray(o.completedSongs)
    ? [...new Set(o.completedSongs.filter((x): x is string => typeof x === 'string'))]
    : [];
  return {
    version: 1,
    phase: o.phase as number,
    placementDone: o.placementDone === true,
    cards: sanitizeCards(o.cards),
    bpm,
    attempts,
    bestChangesPerMinute: isNum(o.bestChangesPerMinute) && o.bestChangesPerMinute >= 0 ? o.bestChangesPerMinute : 0,
    bestStrumBpm: isNum(o.bestStrumBpm) && o.bestStrumBpm >= 0 ? o.bestStrumBpm : 0,
    tunedCount: count(o.tunedCount, 0),
    songsCompleted: count(o.songsCompleted, 0),
    completedSongs,
    sessionsInPhase: count(o.sessionsInPhase, 0),
    streak: count(o.streak, 0),
    lastPracticeDay: typeof o.lastPracticeDay === 'string' && DAY_RE.test(o.lastPracticeDay) ? o.lastPracticeDay : null,
    history: sanitizeHistory(o.history),
    settings: { micEnabled: typeof st.micEnabled === 'boolean' ? st.micEnabled : base.settings.micEnabled, sensitivity },
  };
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
