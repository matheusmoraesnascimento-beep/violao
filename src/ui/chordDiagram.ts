import type { ChordDef } from '../chords';

const W = 120;
const H = 150;
const LEFT = 20;
const TOP = 34;
const GAP = 16;
const FRET_H = 20;
const FRETS = 5;

const x = (stringIdx: number) => LEFT + stringIdx * GAP;
const y = (fret: number) => TOP + (fret - 0.5) * FRET_H;

/** SVG do diagrama de acorde. Todos os acordes da biblioteca cabem nas casas 1-5. */
export function chordDiagramSvg(def: ChordDef): string {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    p.push(`<line x1="${x(i)}" y1="${TOP}" x2="${x(i)}" y2="${TOP + FRETS * FRET_H}" stroke="currentColor" stroke-width="1"/>`);
  }
  for (let f = 0; f <= FRETS; f++) {
    const w = f === 0 ? 4 : 1;
    p.push(`<line x1="${x(0)}" y1="${TOP + f * FRET_H}" x2="${x(5)}" y2="${TOP + f * FRET_H}" stroke="currentColor" stroke-width="${w}"/>`);
  }

  def.frets.forEach((fret, i) => {
    if (fret === null) {
      p.push(`<text x="${x(i)}" y="${TOP - 10}" text-anchor="middle" font-size="12" fill="currentColor">x</text>`);
    } else if (fret === 0) {
      p.push(`<circle cx="${x(i)}" cy="${TOP - 14}" r="4" fill="none" stroke="currentColor"/>`);
    }
  });

  if (def.barre) {
    const { fret, from, to } = def.barre;
    p.push(
      `<rect data-barre x="${x(from) - 6}" y="${y(fret) - 6}" width="${x(to) - x(from) + 12}" height="12" rx="6" fill="currentColor" opacity="0.85"/>`,
    );
  }

  def.frets.forEach((fret, i) => {
    if (fret === null || fret === 0) return;
    p.push(`<circle data-dot cx="${x(i)}" cy="${y(fret)}" r="7" fill="currentColor"/>`);
    const finger = def.fingers[i];
    if (finger !== null) {
      p.push(`<text x="${x(i)}" y="${y(fret) + 4}" text-anchor="middle" font-size="10" fill="var(--bg, #fff)">${finger}</text>`);
    }
  });

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Acorde ${def.id}">${p.join('')}</svg>`;
}
