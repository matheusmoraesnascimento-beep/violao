import type { Verdict } from './audio/chord';
import { PHASES, chordsUpTo } from './curriculum';
import { ensureCards } from './scheduler';
import { addDays, type Progress } from './storage';

export const PLACEMENT_CHORDS = ['A', 'D', 'E', 'G', 'C', 'Em', 'Am'];

/** Define a fase inicial e as caixas de Leitner a partir do teste de nivelamento. */
export function applyPlacement(p: Progress, results: Record<string, Verdict>, today: string): void {
  const ok = (id: string) => results[id] === 'ok';
  const known = PLACEMENT_CHORDS.filter(ok);

  p.phase = known.length === 0 ? 1 : PHASES[1].chordIds.every(ok) ? 3 : 2;
  p.placementDone = true;
  p.sessionsInPhase = 0;

  ensureCards(p, today);
  for (const id of chordsUpTo(p.phase)) {
    if (ok(id)) p.cards[id] = { box: 2, due: addDays(today, 2) };
  }
}
