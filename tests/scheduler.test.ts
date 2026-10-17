import { describe, it, expect } from 'vitest';
import {
  advancePhase, changesVerdict, CHANGES_OK, CHANGES_CLOSE, dueChords, ensureCards, phaseComplete, recordApply, recordAttempt, reviewCard, weakestChords,
} from '../src/scheduler';
import { addDays, defaultProgress } from '../src/storage';

const TODAY = '2026-10-17';

describe('reviewCard (Leitner)', () => {
  it('acertos sobem de caixa e espaçam a revisão', () => {
    const p = defaultProgress();
    reviewCard(p, 'Em', 'ok', TODAY);
    expect(p.cards.Em).toEqual({ box: 1, due: '2026-10-18' });
    reviewCard(p, 'Em', 'ok', '2026-10-18');
    expect(p.cards.Em).toEqual({ box: 2, due: '2026-10-20' });
    reviewCard(p, 'Em', 'ok', '2026-10-20');
    expect(p.cards.Em).toEqual({ box: 3, due: '2026-10-24' });
  });
  it('erro volta para a caixa 0 e revisa hoje', () => {
    const p = defaultProgress();
    p.cards.Em = { box: 3, due: TODAY };
    reviewCard(p, 'Em', 'miss', TODAY);
    expect(p.cards.Em).toEqual({ box: 0, due: TODAY });
  });
  it('quase mantém a caixa e revisa amanhã', () => {
    const p = defaultProgress();
    p.cards.Em = { box: 2, due: TODAY };
    reviewCard(p, 'Em', 'close', TODAY);
    expect(p.cards.Em).toEqual({ box: 2, due: '2026-10-18' });
  });
  it('caixa máxima é 5', () => {
    const p = defaultProgress();
    p.cards.Em = { box: 5, due: TODAY };
    reviewCard(p, 'Em', 'ok', TODAY);
    expect(p.cards.Em.box).toBe(5);
  });
});

describe('seleção de acordes', () => {
  it('dueChords ordena pelos mais fracos e respeita exclusões', () => {
    const p = defaultProgress();
    p.cards = {
      Em: { box: 2, due: TODAY },
      Am: { box: 0, due: TODAY },
      E: { box: 1, due: '2026-10-20' },
      A: { box: 1, due: TODAY },
    };
    expect(dueChords(p, TODAY)).toEqual(['Am', 'A', 'Em']);
    expect(dueChords(p, TODAY, ['Am'])).toEqual(['A', 'Em']);
  });
  it('weakestChords usa os acordes liberados na fase', () => {
    const p = defaultProgress();
    p.phase = 2;
    p.cards = { Em: { box: 3, due: TODAY }, Am: { box: 0, due: TODAY }, E: { box: 1, due: TODAY } };
    expect(weakestChords(p, 2)).toEqual(['Am', 'A']);
  });
  it('ensureCards cria cartas dos acordes da fase', () => {
    const p = defaultProgress();
    p.phase = 2;
    ensureCards(p, TODAY);
    expect(Object.keys(p.cards).sort()).toEqual(['A', 'Am', 'D', 'E', 'Em']);
    expect(p.cards.Em).toEqual({ box: 0, due: TODAY });
  });
});

describe('regra de BPM', () => {
  it('3 acertos ≥90% sobem 5 BPM e zeram as tentativas', () => {
    const p = defaultProgress();
    expect(recordAttempt(p, 'strum:pop', 0.95, 70).raised).toBe(false);
    expect(recordAttempt(p, 'strum:pop', 0.95, 70).raised).toBe(false);
    const r = recordAttempt(p, 'strum:pop', 0.95, 70);
    expect(r).toEqual({ raised: true, confirmed: true, bpm: 75 });
    expect(p.bpm['strum:pop']).toBe(75);
    expect(p.attempts['strum:pop']).toEqual([]);
  });
  it('uma tentativa abaixo de 90% impede a subida', () => {
    const p = defaultProgress();
    recordAttempt(p, 'k', 0.95, 60);
    recordAttempt(p, 'k', 0.75, 60);
    expect(recordAttempt(p, 'k', 0.95, 60).raised).toBe(false);
  });
  it('limite de 160 BPM', () => {
    const p = defaultProgress();
    p.bpm.k = 160;
    recordAttempt(p, 'k', 1, 160);
    recordAttempt(p, 'k', 1, 160);
    expect(recordAttempt(p, 'k', 1, 160)).toEqual({ raised: false, confirmed: true, bpm: 160 });
  });
  it('recordApply só sobe o melhor BPM após 3 acertos seguidos naquele BPM', () => {
    const p = defaultProgress();
    recordApply(p, 'strum:down4', 60, 'ok', false);
    recordApply(p, 'strum:down4', 60, 'ok', false);
    expect(p.bestStrumBpm).toBe(0);
    recordApply(p, 'strum:down4', 60, 'close', false);
    expect(p.bestStrumBpm).toBe(0);
    for (let i = 0; i < 3; i++) recordApply(p, 'strum:down4', 60, 'ok', false);
    expect(p.bestStrumBpm).toBe(60);
    expect(p.bpm['strum:down4']).toBe(65);
  });
  it('recordApply confirma o melhor BPM também no limite máximo', () => {
    const p = defaultProgress();
    p.bpm.k = 160;
    for (let i = 0; i < 3; i++) recordApply(p, 'k', 160, 'ok', false);
    expect(p.bestStrumBpm).toBe(160);
  });
  it('recordApply conta cada progressão distinta uma única vez', () => {
    const p = defaultProgress();
    recordApply(p, 'song:pop-g', 70, 'ok', true);
    expect(p.songsCompleted).toBe(1);
    recordApply(p, 'song:pop-g', 70, 'ok', true);
    recordApply(p, 'song:pop-g', 70, 'close', true);
    expect(p.songsCompleted).toBe(1);
    recordApply(p, 'song:rock-a', 70, 'ok', true);
    expect(p.songsCompleted).toBe(2);
    expect(p.completedSongs).toEqual(['song:pop-g', 'song:rock-a']);
  });
});

describe('metas de fase', () => {
  it('fase 1 exige afinar 3 vezes e batida a 60 BPM', () => {
    const p = defaultProgress();
    expect(phaseComplete(p)).toBe(false);
    p.tunedCount = 3;
    expect(phaseComplete(p)).toBe(false);
    p.bestStrumBpm = 60;
    expect(phaseComplete(p)).toBe(true);
  });
  it('advancePhase cria as cartas da nova fase e zera o contador de trocas', () => {
    const p = defaultProgress();
    p.tunedCount = 3;
    p.bestStrumBpm = 60;
    p.sessionsInPhase = 5;
    expect(advancePhase(p, TODAY)).toBe(true);
    expect(p.phase).toBe(2);
    expect(p.sessionsInPhase).toBe(0);
    expect(p.bestStrumBpm).toBe(0);
    expect(Object.keys(p.cards)).toHaveLength(5);
  });
  it('advancePhase não avança sem cumprir a meta', () => {
    const p = defaultProgress();
    expect(advancePhase(p, TODAY)).toBe(false);
    expect(p.phase).toBe(1);
  });
  it('fase 2 exige trocas/min e acordes dominados (caixa ≥3)', () => {
    const p = defaultProgress();
    p.phase = 2;
    ensureCards(p, TODAY);
    p.bestChangesPerMinute = 30;
    expect(phaseComplete(p)).toBe(false);
    for (const c of Object.values(p.cards)) c.box = 3;
    expect(phaseComplete(p)).toBe(true);
  });
  it('a última fase não avança', () => {
    const p = defaultProgress();
    p.phase = 6;
    ensureCards(p, TODAY);
    p.bestChangesPerMinute = 99;
    for (const c of Object.values(p.cards)) c.box = 5;
    expect(advancePhase(p, TODAY)).toBe(false);
  });
});

describe('changesVerdict', () => {
  it('usa os limiares 15 (ok) e 8 (close)', () => {
    expect([CHANGES_OK, CHANGES_CLOSE]).toEqual([15, 8]);
    expect(changesVerdict(20)).toBe('ok');
    expect(changesVerdict(15)).toBe('ok');
    expect(changesVerdict(14)).toBe('close');
    expect(changesVerdict(8)).toBe('close');
    expect(changesVerdict(7)).toBe('miss');
    expect(changesVerdict(0)).toBe('miss');
  });
});

describe('par de troca é revisado', () => {
  it('a caixa do par sobe e a fase 2 é concluída em alguns dias', () => {
    const p = defaultProgress();
    p.phase = 2;
    p.bestChangesPerMinute = 30;
    let day = TODAY;
    let done = false;
    for (let i = 0; i < 60 && !done; i++) {
      ensureCards(p, day);
      const pair = weakestChords(p, 2);
      for (const id of dueChords(p, day, pair).slice(0, 3)) reviewCard(p, id, 'ok', day);
      for (const id of pair) reviewCard(p, id, changesVerdict(20), day);
      done = phaseComplete(p);
      day = addDays(day, 1);
    }
    expect(done).toBe(true);
    expect(advancePhase(p, day)).toBe(true);
  });
});
