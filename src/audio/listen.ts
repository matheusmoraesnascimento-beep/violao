import { checkChord, type ChordResult } from './chord';
import { rms } from './level';
import type { Mic } from './mic';

/** Confere o acorde esperado ~8x por segundo. Retorna a função que para a escuta. */
export function listenChord(
  mic: Mic,
  getPcs: () => number[],
  minRms: number,
  onResult: (r: ChordResult) => void,
  intervalMs = 125,
): () => void {
  const id = window.setInterval(() => {
    onResult(checkChord(mic.read(), mic.sampleRate, getPcs(), minRms));
  }, intervalMs);
  return () => window.clearInterval(id);
}

/** Percentil `p` (0-1) de uma lista já ordenada; 0 se vazia. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[i];
}

/** Mede o ruído de fundo (percentil 25 do RMS, robusto a quem já toca) por `ms` milissegundos. */
export function calibrate(mic: Mic, ms: number): Promise<number> {
  return new Promise((resolve) => {
    const samples: number[] = [];
    const id = window.setInterval(() => samples.push(rms(mic.read())), 100);
    window.setTimeout(() => {
      window.clearInterval(id);
      resolve(percentile([...samples].sort((a, b) => a - b), 0.25));
    }, ms);
  });
}
