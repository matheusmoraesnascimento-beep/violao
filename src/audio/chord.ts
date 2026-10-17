import { midiToFreq } from '../theory';
import { rms } from './level';

export type Verdict = 'ok' | 'close' | 'miss';

export interface ChordResult {
  verdict: Verdict;
  /** 0..1 */
  score: number;
  /** Classes de altura esperadas que não soaram. */
  missing: number[];
  /** Classes de altura que soaram e não pertencem ao acorde. */
  extra: number[];
}

/** Abaixo disso (relativo à classe mais forte) a nota conta como ausente. */
export const MISSING_BELOW = 0.2;
/** Acima disso, nota fora do acorde conta como sobrando. */
export const EXTRA_ABOVE = 0.7;

const LOW_MIDI = 40; // E2
const HIGH_MIDI = 76; // E5

export function goertzelPower(buf: Float32Array, sampleRate: number, freq: number): number {
  const coeff = 2 * Math.cos((2 * Math.PI * freq) / sampleRate);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < buf.length; i++) {
    const s0 = buf[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

/** Força relativa (0..1) de cada uma das 12 classes de altura. */
export function chromaStrengths(buf: Float32Array, sampleRate: number): number[] {
  const n = buf.length;
  const windowed = new Float32Array(n);
  for (let i = 0; i < n; i++) windowed[i] = buf[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));

  const chroma = new Array<number>(12).fill(0);
  for (let m = LOW_MIDI; m <= HIGH_MIDI; m++) {
    chroma[m % 12] += Math.sqrt(goertzelPower(windowed, sampleRate, midiToFreq(m)));
  }
  const max = Math.max(...chroma);
  return max <= 0 ? chroma : chroma.map((v) => v / max);
}

function nearExpected(pc: number, expected: number[]): boolean {
  return expected.some((e) => {
    const d = (pc - e + 12) % 12;
    return d === 1 || d === 11;
  });
}

export function checkChord(
  buf: Float32Array,
  sampleRate: number,
  expected: number[],
  minRms = 0.005,
): ChordResult {
  if (rms(buf) < minRms) return { verdict: 'miss', score: 0, missing: [...expected], extra: [] };

  const strength = chromaStrengths(buf, sampleRate);
  const missing = expected.filter((pc) => strength[pc] < MISSING_BELOW);

  // Semitons vizinhos de notas esperadas são ignorados: o vazamento espectral
  // das cordas graves cai neles.
  const extra: number[] = [];
  for (let pc = 0; pc < 12; pc++) {
    if (!expected.includes(pc) && !nearExpected(pc, expected) && strength[pc] > EXTRA_ABOVE) extra.push(pc);
  }

  const score = Math.max(0, Math.min(1, 1 - missing.length / expected.length - 0.25 * extra.length));

  let verdict: Verdict = 'miss';
  if (missing.length === 0 && extra.length === 0) verdict = 'ok';
  else if (missing.length <= 1 && extra.length === 0 && expected.length >= 3) verdict = 'close';
  else if (missing.length === 0 && extra.length <= 1) verdict = 'close';

  return { verdict, score, missing, extra };
}
