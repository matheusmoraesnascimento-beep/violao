import { describe, it, expect } from 'vitest';
import { chordDiagramSvg } from '../src/ui/chordDiagram';
import { getChord } from '../src/chords';

const dots = (svg: string) => (svg.match(/data-dot/g) ?? []).length;

describe('chordDiagramSvg', () => {
  it('Em tem 2 casas pressionadas', () => {
    expect(dots(chordDiagramSvg(getChord('Em')))).toBe(2);
  });
  it('Am tem 3 casas pressionadas', () => {
    expect(dots(chordDiagramSvg(getChord('Am')))).toBe(3);
  });
  it('F com pestana desenha a pestana', () => {
    expect(chordDiagramSvg(getChord('F'))).toContain('data-barre');
  });
  it('tem rótulo de acessibilidade com o nome', () => {
    expect(chordDiagramSvg(getChord('G'))).toContain('aria-label="Acorde G"');
  });
});
