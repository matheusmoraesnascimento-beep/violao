import { describe, it, expect } from 'vitest';
import { ChangeCounter } from '../src/audio/changeCounter';

describe('ChangeCounter', () => {
  it('2 leituras ok seguidas contam 1 troca e alternam o alvo', () => {
    const c = new ChangeCounter(['Em', 'Am']);
    expect(c.target).toBe('Em');
    expect(c.feed('ok')).toBe(false);
    expect(c.feed('ok')).toBe(true);
    expect(c.count).toBe(1);
    expect(c.target).toBe('Am');
  });
  it('leitura ruim no meio zera a sequência', () => {
    const c = new ChangeCounter(['Em', 'Am']);
    c.feed('ok');
    c.feed('miss');
    c.feed('ok');
    expect(c.count).toBe(0);
  });
  it('conta várias trocas', () => {
    const c = new ChangeCounter(['Em', 'Am']);
    for (const v of ['ok', 'ok', 'miss', 'ok', 'ok', 'close', 'ok', 'ok'] as const) c.feed(v);
    expect(c.count).toBe(3);
    expect(c.target).toBe('Am');
  });
  it('contagem manual alterna o alvo', () => {
    const c = new ChangeCounter(['Em', 'Am']);
    c.manual();
    expect(c.count).toBe(1);
    expect(c.target).toBe('Am');
  });
});
