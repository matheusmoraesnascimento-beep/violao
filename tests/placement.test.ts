import { describe, it, expect } from 'vitest';
import { PLACEMENT_CHORDS, applyPlacement } from '../src/placement';
import { defaultProgress } from '../src/storage';
import type { Verdict } from '../src/audio/chord';

const TODAY = '2026-10-17';
const all = (v: Verdict) => Object.fromEntries(PLACEMENT_CHORDS.map((id) => [id, v])) as Record<string, Verdict>;

describe('applyPlacement', () => {
  it('nenhum acorde → fase 1', () => {
    const p = defaultProgress();
    applyPlacement(p, all('miss'), TODAY);
    expect(p.phase).toBe(1);
    expect(p.placementDone).toBe(true);
  });
  it('só alguns acordes → fase 2, conhecidos na caixa 2', () => {
    const p = defaultProgress();
    applyPlacement(p, { ...all('miss'), Em: 'ok' }, TODAY);
    expect(p.phase).toBe(2);
    expect(p.cards.Em).toEqual({ box: 2, due: '2026-10-19' });
    expect(p.cards.A).toEqual({ box: 0, due: TODAY });
  });
  it('todos os acordes da fase 2 → fase 3', () => {
    const p = defaultProgress();
    applyPlacement(p, all('ok'), TODAY);
    expect(p.phase).toBe(3);
    expect(p.cards.G.box).toBe(2);
    expect(p.cards.Dm).toEqual({ box: 0, due: TODAY });
  });
  it('"quase" não conta como conhecido', () => {
    const p = defaultProgress();
    applyPlacement(p, all('close'), TODAY);
    expect(p.phase).toBe(1);
  });
});
