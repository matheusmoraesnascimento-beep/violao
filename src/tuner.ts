import { OPEN_STRINGS_MIDI, centsOff, midiToFreq } from './theory';

export const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'] as const;

export interface StringMatch {
  index: number;
  label: string;
  targetFreq: number;
  cents: number;
}

export function nearestString(freq: number): StringMatch {
  let best = 0;
  let bestAbs = Infinity;
  OPEN_STRINGS_MIDI.forEach((midi, i) => {
    const c = Math.abs(centsOff(freq, midiToFreq(midi)));
    if (c < bestAbs) {
      bestAbs = c;
      best = i;
    }
  });
  const targetFreq = midiToFreq(OPEN_STRINGS_MIDI[best]);
  return { index: best, label: STRING_LABELS[best], targetFreq, cents: centsOff(freq, targetFreq) };
}

/** Mede `freq` só contra a corda `index`; null se estiver a mais de 400 cents (oitava errada/ruído). */
export function matchTarget(freq: number, index: number): StringMatch | null {
  const targetFreq = midiToFreq(OPEN_STRINGS_MIDI[index]);
  const cents = centsOff(freq, targetFreq);
  if (!Number.isFinite(cents) || Math.abs(cents) > 400) return null;
  return { index, label: STRING_LABELS[index], targetFreq, cents };
}

export type TuneState = 'flat' | 'sharp' | 'ok';

export function tuneState(cents: number, tolerance = 5): TuneState {
  if (Math.abs(cents) <= tolerance) return 'ok';
  return cents < 0 ? 'flat' : 'sharp';
}
