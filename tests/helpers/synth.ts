/** Soma senoides. `harmonics` são multiplicadores de frequência; a amplitude do harmônico h é 1/h. */
export function synth(freqs: number[], sampleRate = 44100, n = 4096, harmonics = [1]): Float32Array {
  const out = new Float32Array(n);
  for (const f of freqs) {
    for (const h of harmonics) {
      const amp = 1 / h;
      for (let i = 0; i < n; i++) out[i] += amp * Math.sin((2 * Math.PI * f * h * i) / sampleRate);
    }
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < n; i++) out[i] = (out[i] / peak) * 0.5;
  return out;
}

/** Ruído branco determinístico. */
export function noise(n = 4096, seed = 1): Float32Array {
  let s = seed;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = (s / 0xffffffff - 0.5) * 0.6;
  }
  return out;
}
