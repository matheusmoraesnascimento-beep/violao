export type MicError = 'denied' | 'unsupported' | 'notfound';

export class Mic {
  private readonly buf: Float32Array<ArrayBuffer>;

  constructor(
    private readonly ctx: AudioContext,
    private readonly stream: MediaStream,
    private readonly analyser: AnalyserNode,
  ) {
    this.buf = new Float32Array(analyser.fftSize);
  }

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }

  /** Últimas `fftSize` amostras (8192). O mesmo buffer é reaproveitado a cada leitura. */
  read(): Float32Array {
    this.analyser.getFloatTimeDomainData(this.buf);
    return this.buf;
  }

  stop(): void {
    this.stream.getTracks().forEach((t) => t.stop());
    void this.ctx.close();
  }
}

export async function startMic(): Promise<{ mic: Mic } | { error: MicError }> {
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!navigator.mediaDevices?.getUserMedia || !AC) return { error: 'unsupported' };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = new AC();
    if (ctx.state === 'suspended') await ctx.resume();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    ctx.createMediaStreamSource(stream).connect(analyser);
    return { mic: new Mic(ctx, stream, analyser) };
  } catch (e) {
    const name = (e as DOMException).name;
    return { error: name === 'NotFoundError' || name === 'OverconstrainedError' ? 'notfound' : 'denied' };
  }
}
