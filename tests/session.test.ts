import { describe, it, expect } from 'vitest';
import { buildSession } from '../src/session';
import { ensureCards } from '../src/scheduler';
import { defaultProgress } from '../src/storage';

const TODAY = '2026-10-17';

describe('buildSession', () => {
  it('fase 1: afinação, aquecimento, técnica e ritmo (sem troca de acordes)', () => {
    const blocks = buildSession(defaultProgress(), TODAY);
    expect(blocks.map((b) => b.kind)).toEqual(['tune', 'warmup', 'technique', 'apply']);
    const apply = blocks[3];
    expect(apply.patternId).toBe('down4');
    expect(apply.bpm).toBe(60);
    expect(apply.bpmKey).toBe('strum:down4');
  });
  it('fase 2: troca de acordes com os 2 mais fracos e revisão dos demais vencidos', () => {
    const p = defaultProgress();
    p.phase = 2;
    ensureCards(p, TODAY);
    const blocks = buildSession(p, TODAY);
    expect(blocks.map((b) => b.kind)).toEqual(['tune', 'warmup', 'technique', 'changes', 'apply', 'review']);
    const changes = blocks.find((b) => b.kind === 'changes')!;
    expect(changes.pair).toEqual(['Em', 'Am']);
    const review = blocks.find((b) => b.kind === 'review')!;
    expect(review.chordIds).toEqual(['E', 'A', 'D']);
  });
  it('a dica de técnica gira com sessionsInPhase', () => {
    const p = defaultProgress();
    const a = buildSession(p, TODAY)[2].title;
    p.sessionsInPhase = 1;
    const b = buildSession(p, TODAY)[2].title;
    expect(a).not.toBe(b);
  });
  it('fase 4 alterna batidas e usa 4 acordes', () => {
    const p = defaultProgress();
    p.phase = 4;
    ensureCards(p, TODAY);
    const a = buildSession(p, TODAY).find((b) => b.kind === 'apply')!;
    expect(a.patternId).toBe('pop');
    expect(a.chordIds).toHaveLength(4);
    p.sessionsInPhase = 1;
    expect(buildSession(p, TODAY).find((b) => b.kind === 'apply')!.patternId).toBe('sertanejo');
  });
  it('fase 5 toca progressões como música', () => {
    const p = defaultProgress();
    p.phase = 5;
    ensureCards(p, TODAY);
    const a = buildSession(p, TODAY).find((b) => b.kind === 'apply')!;
    expect(a.isSong).toBe(true);
    expect(a.bpmKey).toMatch(/^song:/);
  });
  it('usa o BPM guardado quando existe', () => {
    const p = defaultProgress();
    p.bpm['strum:down4'] = 75;
    expect(buildSession(p, TODAY).find((b) => b.kind === 'apply')!.bpm).toBe(75);
  });
});
