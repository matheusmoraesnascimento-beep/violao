import { describe, it, expect } from 'vitest';
import { checkChord } from '../src/audio/chord';
import { synth } from './helpers/synth';

const SR = 44100;
const N = 8192;
const H = [1, 2, 3];

// Frequências (Hz)
const C3 = 130.81, E3 = 164.81, G3 = 196.0, C4 = 261.63, E4 = 329.63;
const A2 = 110.0, A3 = 220.0;

const C_MAJOR = [0, 4, 7];

describe('checkChord', () => {
  it('C maior completo → ok', () => {
    const r = checkChord(synth([C3, E3, G3, C4, E4], SR, N, H), SR, C_MAJOR);
    expect(r.verdict).toBe('ok');
    expect(r.missing).toEqual([]);
  });
  it('falta uma nota (C) → close e lista a nota faltante', () => {
    const r = checkChord(synth([E3, G3], SR, N, H), SR, C_MAJOR);
    expect(r.verdict).toBe('close');
    expect(r.missing).toEqual([0]);
  });
  it('nota única → miss', () => {
    const r = checkChord(synth([E3], SR, N, H), SR, C_MAJOR);
    expect(r.verdict).toBe('miss');
  });
  it('Am tocado quando se pede C → miss (G falta e A sobra)', () => {
    const r = checkChord(synth([A2, E3, A3, C4, E4], SR, N, H), SR, C_MAJOR);
    expect(r.verdict).toBe('miss');
    expect(r.extra).toContain(9);
  });
  it('silêncio → miss com tudo faltando', () => {
    const r = checkChord(new Float32Array(N), SR, C_MAJOR);
    expect(r.verdict).toBe('miss');
    expect(r.missing).toEqual(C_MAJOR);
    expect(r.score).toBe(0);
  });
  it('power chord (2 notas) ok quando as duas soam', () => {
    // E5 = E + B
    const r = checkChord(synth([82.41, 123.47, 164.81], SR, N, H), SR, [4, 11]);
    expect(r.verdict).toBe('ok');
  });
});
