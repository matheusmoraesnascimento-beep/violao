import { describe, it, expect } from 'vitest';
import { nearestString, tuneState } from '../src/tuner';

describe('tuner', () => {
  it('110 Hz é a corda A, afinada', () => {
    const m = nearestString(110);
    expect(m.index).toBe(1);
    expect(m.label).toBe('A');
    expect(m.cents).toBeCloseTo(0, 3);
  });
  it('82.41 Hz é a corda E grave', () => {
    expect(nearestString(82.41).index).toBe(0);
  });
  it('329.63 Hz é a corda e aguda', () => {
    expect(nearestString(329.63).index).toBe(5);
  });
  it('estado de afinação', () => {
    expect(tuneState(-12)).toBe('flat');
    expect(tuneState(3)).toBe('ok');
    expect(tuneState(20)).toBe('sharp');
  });
});
