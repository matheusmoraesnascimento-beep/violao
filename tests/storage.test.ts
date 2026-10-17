import { describe, it, expect } from 'vitest';
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
