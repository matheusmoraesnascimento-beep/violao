import { describe, it, expect } from 'vitest';
import { beatIntervalSec } from '../src/audio/metronome';

describe('beatIntervalSec', () => {
  it('60 BPM = 1 s, 120 BPM = 0.5 s', () => {
    expect(beatIntervalSec(60)).toBe(1);
    expect(beatIntervalSec(120)).toBe(0.5);
  });
});
