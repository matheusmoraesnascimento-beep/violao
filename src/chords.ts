import { OPEN_STRINGS_MIDI, pitchClass } from './theory';

export interface ChordDef {
  id: string;
  name: string;
  /** Casa por corda, da E grave para a e aguda. null = abafada, 0 = solta. */
  frets: (number | null)[];
  /** Dedo (1-4) por corda; null onde não há dedo. */
  fingers: (number | null)[];
  /** Pestana: casa e cordas (índices 0-5, inclusivos). */
  barre?: { fret: number; from: number; to: number };
}

const n = null;

export const CHORDS: Record<string, ChordDef> = {
  Em: { id: 'Em', name: 'Mi menor (Em)', frets: [0, 2, 2, 0, 0, 0], fingers: [n, 2, 3, n, n, n] },
  Am: { id: 'Am', name: 'Lá menor (Am)', frets: [n, 0, 2, 2, 1, 0], fingers: [n, n, 2, 3, 1, n] },
  E: { id: 'E', name: 'Mi maior (E)', frets: [0, 2, 2, 1, 0, 0], fingers: [n, 2, 3, 1, n, n] },
  A: { id: 'A', name: 'Lá maior (A)', frets: [n, 0, 2, 2, 2, 0], fingers: [n, n, 1, 2, 3, n] },
  D: { id: 'D', name: 'Ré maior (D)', frets: [n, n, 0, 2, 3, 2], fingers: [n, n, n, 1, 3, 2] },
  G: { id: 'G', name: 'Sol maior (G)', frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, n, n, n, 3] },
  C: { id: 'C', name: 'Dó maior (C)', frets: [n, 3, 2, 0, 1, 0], fingers: [n, 3, 2, n, 1, n] },
  Dm: { id: 'Dm', name: 'Ré menor (Dm)', frets: [n, n, 0, 2, 3, 1], fingers: [n, n, n, 2, 3, 1] },
  F4: {
    id: 'F4',
    name: 'Fá maior fácil (F, 4 cordas)',
    frets: [n, n, 3, 2, 1, 1],
    fingers: [n, n, 4, 3, 1, 1],
    barre: { fret: 1, from: 4, to: 5 },
  },
  Bm: {
    id: 'Bm',
    name: 'Si menor (Bm, pestana)',
    frets: [n, 2, 4, 4, 3, 2],
    fingers: [n, 1, 3, 4, 2, 1],
    barre: { fret: 2, from: 1, to: 5 },
  },
  F: {
    id: 'F',
    name: 'Fá maior (F, pestana)',
    frets: [1, 3, 3, 2, 1, 1],
    fingers: [1, 3, 4, 2, 1, 1],
    barre: { fret: 1, from: 0, to: 5 },
  },
  E5: { id: 'E5', name: 'Power chord E5', frets: [0, 2, 2, n, n, n], fingers: [n, 1, 2, n, n, n] },
  A5: { id: 'A5', name: 'Power chord A5', frets: [n, 0, 2, 2, n, n], fingers: [n, n, 1, 2, n, n] },
  D5: { id: 'D5', name: 'Power chord D5', frets: [n, n, 0, 2, 3, n], fingers: [n, n, n, 1, 2, n] },
  G5: { id: 'G5', name: 'Power chord G5', frets: [3, 5, 5, n, n, n], fingers: [1, 3, 4, n, n, n] },
};

export function getChord(id: string): ChordDef {
  const c = CHORDS[id];
  if (!c) throw new Error(`Acorde desconhecido: ${id}`);
  return c;
}

/** Classes de altura (0-11), únicas e ordenadas, que o dedilhado produz. */
export function chordPcs(def: ChordDef): number[] {
  const set = new Set<number>();
  def.frets.forEach((fret, i) => {
    if (fret !== null) set.add(pitchClass(OPEN_STRINGS_MIDI[i] + fret));
  });
  return [...set].sort((a, b) => a - b);
}
