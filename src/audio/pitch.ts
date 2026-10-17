import { rms } from './level';

export interface PitchResult {
  freq: number;
  /** 0..1, quanto maior mais periódico. */
  clarity: number;
}

/**
 * Algoritmo YIN. Retorna null para silêncio ou sinal sem periodicidade clara.
 * `buf` deve ter pelo menos 4096 amostras a 44.1 kHz para alcançar 70 Hz.
 */
export function detectPitch(
  buf: Float32Array,
  sampleRate: number,
  threshold = 0.15,
  minFreq = 70,
  maxFreq = 1000,
): PitchResult | null {
  if (rms(buf) < 0.005) return null;

  const maxTau = Math.min(Math.floor(sampleRate / minFreq), Math.floor(buf.length / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / maxFreq));
  const window = buf.length - maxTau;

  const diff = new Float32Array(maxTau);
  for (let tau = 1; tau < maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < window; i++) {
      const d = buf[i] - buf[i + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  const cmnd = new Float32Array(maxTau);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau < maxTau; tau++) {
    running += diff[tau];
    cmnd[tau] = running === 0 ? 1 : (diff[tau] * tau) / running;
  }

  let tau = minTau;
  while (tau < maxTau) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 < maxTau && cmnd[tau + 1] < cmnd[tau]) tau++;
      break;
    }
    tau++;
  }
  if (tau >= maxTau) return null;

  let better = tau;
  if (tau > 1 && tau + 1 < maxTau) {
    const s0 = cmnd[tau - 1];
    const s1 = cmnd[tau];
    const s2 = cmnd[tau + 1];
    const denom = s0 - 2 * s1 + s2;
    if (denom !== 0) better = tau + (s0 - s2) / (2 * denom);
  }

  return { freq: sampleRate / better, clarity: 1 - cmnd[tau] };
}
