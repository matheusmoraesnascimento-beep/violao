import { describe, it, expect } from 'vitest';
import { freqToMidi, midiToFreq, noteName, pitchClass, centsOff } from '../src/theory';

describe('theory', () => {
  it('A4 = 440 Hz = MIDI 69', () => {
    expect(freqToMidi(440)).toBeCloseTo(69, 6);
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
  });
  it('nomeia notas', () => {
    expect(noteName(60)).toBe('C');
    expect(noteName(64)).toBe('E');
    expect(pitchClass(40)).toBe(4);
  });
  it('cents', () => {
    expect(centsOff(440 * 2 ** (10 / 1200), 440)).toBeCloseTo(10, 6);
  });
});
