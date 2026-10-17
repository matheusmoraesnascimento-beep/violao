import { describe, it, expect } from 'vitest';
import { PHASES, PATTERNS, PROGRESSIONS, WARMUPS, chordsUpTo } from '../src/curriculum';
import { CHORDS } from '../src/chords';

describe('curriculum', () => {
  it('tem 6 fases sequenciais com meta e dicas', () => {
    expect(PHASES.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const p of PHASES) {
      expect(p.goal.description.length).toBeGreaterThan(0);
      expect(p.tips.length).toBeGreaterThanOrEqual(3);
    }
  });
  it('todo acorde referenciado existe na biblioteca', () => {
    for (const p of PHASES) for (const id of p.chordIds) expect(CHORDS[id], id).toBeDefined();
    for (const pr of PROGRESSIONS) for (const id of pr.chordIds) expect(CHORDS[id], id).toBeDefined();
  });
  it('progressões só usam acordes liberados até a fase 5', () => {
    const known = chordsUpTo(5);
    for (const pr of PROGRESSIONS) for (const id of pr.chordIds) expect(known, pr.id).toContain(id);
  });
  it('toda progressão aponta para uma batida existente', () => {
    for (const pr of PROGRESSIONS) expect(PATTERNS[pr.patternId], pr.id).toBeDefined();
  });
  it('batidas têm 8 posições', () => {
    for (const pat of Object.values(PATTERNS)) expect(pat.slots).toHaveLength(8);
  });
  it('chordsUpTo é cumulativo', () => {
    expect(chordsUpTo(1)).toEqual([]);
    expect(chordsUpTo(2)).toEqual(['Em', 'Am', 'E', 'A', 'D']);
    expect(chordsUpTo(3)).toHaveLength(9);
    expect(chordsUpTo(6)).toHaveLength(15);
  });
  it('há aquecimentos', () => {
    expect(WARMUPS.length).toBeGreaterThanOrEqual(3);
  });
});
