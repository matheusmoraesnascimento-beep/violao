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

/** Mede o ruído de fundo (RMS médio) por `ms` milissegundos. */
export function calibrate(mic: Mic, ms: number): Promise<number> {
  return new Promise((resolve) => {
    const samples: number[] = [];
    const id = window.setInterval(() => samples.push(rms(mic.read())), 100);
    window.setTimeout(() => {
      window.clearInterval(id);
      resolve(samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0);
    }, ms);
  });
}
