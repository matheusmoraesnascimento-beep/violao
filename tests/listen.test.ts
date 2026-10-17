import { describe, it, expect } from 'vitest';
import { percentile } from '../src/audio/listen';

describe('percentile', () => {
  it('vazio retorna 0', () => {
    expect(percentile([], 0.25)).toBe(0);
  });
  it('pega o 25º percentil de amostras ordenadas', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8], 0.25)).toBe(3);
    expect(percentile([5], 0.25)).toBe(5);
  });
  it('limita os extremos', () => {
    expect(percentile([1, 2, 3], 0)).toBe(1);
    expect(percentile([1, 2, 3], 1)).toBe(3);
  });
});
