import type { Verdict } from './audio/chord';
import { PHASES, chordsUpTo } from './curriculum';
import { addDays, type Progress } from './storage';

/** Dias até a próxima revisão por caixa de Leitner (0-5). */
export const INTERVALS = [0, 1, 2, 4, 8, 16];
export const MASTERED_BOX = 3;
export const BPM_STEP = 5;
export const BPM_MAX = 160;
export const ACCURACY_TARGET = 0.9;
export const ATTEMPTS_NEEDED = 3;

export const VERDICT_ACCURACY: Record<Verdict, number> = { ok: 0.95, close: 0.75, miss: 0.4 };

/** Trocas limpas em 1 minuto: >= CHANGES_OK é 'ok', >= CHANGES_CLOSE é 'close', senão 'miss'. */
export const CHANGES_OK = 15;
export const CHANGES_CLOSE = 8;

export function changesVerdict(count: number): Verdict {
  if (count >= CHANGES_OK) return 'ok';
  if (count >= CHANGES_CLOSE) return 'close';
  return 'miss';
}

export function reviewCard(p: Progress, chordId: string, verdict: Verdict, today: string): void {
  const card = p.cards[chordId] ?? { box: 0, due: today };
  if (verdict === 'ok') card.box = Math.min(5, card.box + 1);
  else if (verdict === 'miss') card.box = 0;
  card.due = addDays(today, verdict === 'close' ? 1 : INTERVALS[card.box]);
  p.cards[chordId] = card;
}

export function ensureCards(p: Progress, today: string): void {
  for (const id of chordsUpTo(p.phase)) {
    if (!p.cards[id]) p.cards[id] = { box: 0, due: today };
  }
}

/** Acordes com revisão vencida, mais fracos primeiro. */
export function dueChords(p: Progress, today: string, exclude: string[] = []): string[] {
  return Object.entries(p.cards)
    .filter(([id, c]) => c.due <= today && !exclude.includes(id))
    .sort((a, b) => a[1].box - b[1].box || (a[1].due < b[1].due ? -1 : 1))
    .map(([id]) => id);
}

/** Os `n` acordes liberados com menor caixa (empates seguem a ordem do currículo). */
export function weakestChords(p: Progress, n: number): string[] {
  return chordsUpTo(p.phase)
    .map((id, order) => ({ id, order, box: p.cards[id]?.box ?? 0 }))
    .sort((a, b) => a.box - b.box || a.order - b.order)
    .slice(0, n)
    .map((x) => x.id);
}

export function shouldRaiseBpm(attempts: number[]): boolean {
  return attempts.length >= ATTEMPTS_NEEDED && attempts.slice(-ATTEMPTS_NEEDED).every((a) => a >= ACCURACY_TARGET);
}

export function recordAttempt(
  p: Progress,
  key: string,
  accuracy: number,
  startBpm: number,
): { raised: boolean; bpm: number } {
  const current = p.bpm[key] ?? startBpm;
  const list = [...(p.attempts[key] ?? []), accuracy].slice(-ATTEMPTS_NEEDED);
  if (shouldRaiseBpm(list)) {
    const next = Math.min(BPM_MAX, current + BPM_STEP);
    p.bpm[key] = next;
    p.attempts[key] = [];
    return { raised: next > current, bpm: next };
  }
  p.bpm[key] = current;
  p.attempts[key] = list;
  return { raised: false, bpm: current };
}

export function recordApply(
  p: Progress,
  key: string,
  bpmUsed: number,
  verdict: Verdict,
  isSong: boolean,
): { raised: boolean; bpm: number } {
  const accuracy = VERDICT_ACCURACY[verdict];
  if (accuracy >= ACCURACY_TARGET) {
    p.bestStrumBpm = Math.max(p.bestStrumBpm, bpmUsed);
    if (isSong) p.songsCompleted++;
  }
  return recordAttempt(p, key, accuracy, bpmUsed);
}

export function phaseComplete(p: Progress): boolean {
  const g = PHASES[p.phase - 1].goal;
  if (g.tunedTimes !== undefined && p.tunedCount < g.tunedTimes) return false;
  if (g.strumBpm !== undefined && p.bestStrumBpm < g.strumBpm) return false;
  if (g.changesPerMinute !== undefined && p.bestChangesPerMinute < g.changesPerMinute) return false;
  if (g.songsCompleted !== undefined && p.songsCompleted < g.songsCompleted) return false;
  if (g.chordsMastered && !chordsUpTo(p.phase).every((id) => (p.cards[id]?.box ?? 0) >= MASTERED_BOX)) return false;
  return true;
}

export function advancePhase(p: Progress, today: string): boolean {
  if (p.phase >= PHASES.length || !phaseComplete(p)) return false;
  p.phase++;
  p.bestChangesPerMinute = 0;
  p.sessionsInPhase = 0;
  ensureCards(p, today);
  return true;
}
