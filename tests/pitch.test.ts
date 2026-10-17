import { describe, it, expect } from 'vitest';
import { detectPitch } from '../src/audio/pitch';
import { centsOff } from '../src/theory';
import { synth, noise } from './helpers/synth';

const SR = 44100;

describe('detectPitch (YIN)', () => {
  for (const f of [82.41, 110, 196, 329.63]) {
    it(`detecta senoide de ${f} Hz`, () => {
      const r = detectPitch(synth([f], SR), SR);
      expect(r).not.toBeNull();
      expect(Math.abs(centsOff(r!.freq, f))).toBeLessThan(10);
    });
  }
  it('detecta fundamental com harmônicos (196 Hz)', () => {
    const r = detectPitch(synth([196], SR, 4096, [1, 2, 3]), SR);
    expect(r).not.toBeNull();
    expect(Math.abs(centsOff(r!.freq, 196))).toBeLessThan(10);
  });
  it('silêncio retorna null', () => {
    expect(detectPitch(new Float32Array(4096), SR)).toBeNull();
  });
  it('ruído branco retorna null', () => {
    expect(detectPitch(noise(4096), SR)).toBeNull();
  });
});
