import { describe, it, expect } from 'vitest';
import { ensureCards } from '../src/scheduler';
import {
  addDays, daysBetween, defaultProgress, loadProgress, parseProgress, saveProgress, updateStreak, type KV,
} from '../src/storage';

function fakeStore(initial: Record<string, string> = {}): KV & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('datas', () => {
  it('addDays cruza mês e ano', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-10-17', 0)).toBe('2026-10-17');
  });
  it('daysBetween', () => {
    expect(daysBetween('2026-10-17', '2026-10-19')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });
});

describe('streak', () => {
  it('primeiro dia = 1', () => {
    const p = defaultProgress();
    updateStreak(p, '2026-10-17');
    expect(p.streak).toBe(1);
  });
  it('dias seguidos incrementam', () => {
    const p = defaultProgress();
    updateStreak(p, '2026-10-17');
    updateStreak(p, '2026-10-18');
    expect(p.streak).toBe(2);
  });
  it('um dia de descanso não quebra', () => {
    const p = defaultProgress();
    updateStreak(p, '2026-10-17');
    updateStreak(p, '2026-10-19');
    expect(p.streak).toBe(2);
  });
  it('dois dias sem praticar quebram', () => {
    const p = defaultProgress();
    updateStreak(p, '2026-10-17');
    updateStreak(p, '2026-10-20');
    expect(p.streak).toBe(1);
  });
  it('mesmo dia não incrementa', () => {
    const p = defaultProgress();
    updateStreak(p, '2026-10-17');
    updateStreak(p, '2026-10-17');
    expect(p.streak).toBe(1);
  });
});

describe('persistência', () => {
  it('salva e carrega', () => {
    const store = fakeStore();
    const p = defaultProgress();
    p.phase = 3;
    p.tunedCount = 4;
    expect(saveProgress(p, store)).toBe(true);
    const loaded = loadProgress(store);
    expect(loaded.phase).toBe(3);
    expect(loaded.tunedCount).toBe(4);
  });
  it('sem dados devolve o padrão', () => {
    expect(loadProgress(fakeStore()).phase).toBe(1);
  });
  it('dados corrompidos viram padrão e o original é guardado', () => {
    const store = fakeStore({ 'violao.progress.v1': '{quebrado' });
    const p = loadProgress(store);
    expect(p.phase).toBe(1);
    expect(store.data.get('violao.progress.v1.corrupt')).toBe('{quebrado');
  });
  it('storage que lança erro não derruba', () => {
    const store: KV = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('bloqueado'); },
      removeItem: () => {},
    };
    expect(loadProgress(store).phase).toBe(1);
    expect(saveProgress(defaultProgress(), store)).toBe(false);
  });
  it('parseProgress rejeita arquivo inválido', () => {
    expect(() => parseProgress('{"version":2}')).toThrow();
    expect(() => parseProgress('{"version":1,"phase":9,"cards":{}}')).toThrow();
    expect(() => parseProgress('lixo')).toThrow();
  });
  it('parseProgress completa campos faltantes', () => {
    const p = parseProgress('{"version":1,"phase":2,"cards":{}}');
    expect(p.phase).toBe(2);
    expect(p.settings.micEnabled).toBe(true);
    expect(p.history).toEqual([]);
  });
});

describe('parseProgress com entrada malformada', () => {
  const parse = (o: unknown) => parseProgress(JSON.stringify({ version: 1, phase: 1, cards: {}, ...(o as object) }));

  it('descarta cartas de acordes desconhecidos ou malformados e limita a caixa', () => {
    const p = parse({
      phase: 2,
      cards: {
        Em: { box: 9, due: '2026-10-17' },
        Am: { box: -3, due: '2026-10-17' },
        Zz: { box: 1, due: '2026-10-17' },
        A: null,
        E: { box: 'x', due: '2026-10-17' },
        D: { box: 1, due: 5 },
        __proto__: { box: 1, due: '2026-10-17' },
      },
    });
    expect(p.cards).toEqual({ Em: { box: 5, due: '2026-10-17' }, Am: { box: 0, due: '2026-10-17' } });
  });
  it('history que não é array vira lista vazia e registros inválidos são descartados', () => {
    expect(parse({ history: 'oi' }).history).toEqual([]);
    const h = parse({
      history: [null, 3, { date: '2026-10-17', changesPerMinute: null, minutes: 5, partial: false }, { date: 1 }],
    }).history;
    expect(h).toHaveLength(1);
  });
  it('limita sensibilidade, coage micEnabled e números', () => {
    expect(parse({ settings: { sensitivity: 0, micEnabled: 'sim' } }).settings).toEqual({ micEnabled: true, sensitivity: 0.5 });
    expect(parse({ settings: { sensitivity: 99 } }).settings.sensitivity).toBe(2);
    const p = parse({ tunedCount: -4, streak: 'x', songsCompleted: 2.7, bpm: { a: 'x', b: 70 }, attempts: { a: [0.9, 'x'], b: 5 } });
    expect(p.tunedCount).toBe(0);
    expect(p.streak).toBe(0);
    expect(p.songsCompleted).toBe(2);
    expect(p.bpm).toEqual({ b: 70 });
    expect(p.attempts).toEqual({ a: [0.9] });
  });
  it('fase > 1 com cartas vazias ganha cartas após ensureCards', () => {
    const p = parse({ phase: 3, cards: { Zz: { box: 1, due: '2026-10-17' } } });
    expect(p.cards).toEqual({});
    ensureCards(p, '2026-10-17');
    expect(Object.keys(p.cards).length).toBeGreaterThan(5);
  });
});
