import { describe, it, expect } from 'vitest';
import { CHORDS, getChord, chordPcs } from '../src/chords';

describe('chords', () => {
  it('classes de altura derivadas do dedilhado', () => {
    expect(chordPcs(getChord('Em'))).toEqual([4, 7, 11]);
    expect(chordPcs(getChord('Am'))).toEqual([0, 4, 9]);
    expect(chordPcs(getChord('C'))).toEqual([0, 4, 7]);
    expect(chordPcs(getChord('E5'))).toEqual([4, 11]);
  });
  it('todo acorde tem 6 cordas em frets e fingers', () => {
    for (const c of Object.values(CHORDS)) {
      expect(c.frets).toHaveLength(6);
      expect(c.fingers).toHaveLength(6);
    }
  });
  it('acorde inexistente lança erro', () => {
    expect(() => getChord('XYZ')).toThrow();
  });
});
