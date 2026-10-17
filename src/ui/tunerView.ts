import { rms } from '../audio/level';
import { detectPitch } from '../audio/pitch';
import { micMessage, type App } from '../app';
import { freqToMidi, noteName } from '../theory';
import { STRING_LABELS, matchTarget, nearestString, tuneState } from '../tuner';
import { h } from './dom';

const MESSAGES = {
  flat: 'Grave demais: gire a tarraxa para apertar a corda.',
  sharp: 'Aguda demais: afrouxe a corda.',
  ok: 'Afinada!',
} as const;

/** Monta o afinador em `box`. `onAllTuned` dispara uma vez quando as 6 cordas ficam afinadas. Retorna o cleanup. */
export function mountTuner(box: HTMLElement, app: App, onAllTuned?: () => void): () => void {
  const note = h('div', { class: 'tuner-note' }, '–');
  const needle = h('div', { class: 'needle' });
  const status = h('p', { class: 'status', 'data-testid': 'tuner-status' }, 'Preparando microfone… fique em silêncio por 3 s.');
  let manual: number | null = null;
  let micReady = false;
  let okRun = 0;
  const refresh = (): void => {
    strings.forEach((b, i) => {
      b.classList.toggle('sel', manual === i);
      b.setAttribute('aria-pressed', String(manual === i));
    });
    auto.classList.toggle('active', manual === null);
    auto.setAttribute('aria-pressed', String(manual === null));
    if (micReady) status.textContent = manual !== null ? `Toque a corda ${STRING_LABELS[manual]}.` : 'Toque uma corda.';
  };
  const strings = STRING_LABELS.map((l, i) =>
    h('button', { type: 'button', class: 'str', 'data-testid': `tuner-string-${i}`, 'aria-pressed': 'false', onclick: () => { manual = manual === i ? null : i; okRun = 0; refresh(); } }, l),
  );
  const auto = h('button', { type: 'button', class: 'str auto', 'data-testid': 'tuner-auto', 'aria-pressed': 'true', onclick: () => { manual = null; okRun = 0; refresh(); } }, 'Auto');
  box.append(note, h('div', { class: 'meter' }, needle), status, h('div', { class: 'strings' }, auto, ...strings));

  const tuned = new Set<number>();
  let lastIndex = -1;
  let fired = false;
  let stopped = false;
  let timer: number | undefined;

  void app.ensureMic().then((mic) => {
    if (stopped) return;
    if (!mic) {
      status.textContent = micMessage(app) + ' Afine com outro afinador e continue.';
      return;
    }
    micReady = true;
    refresh();
    timer = window.setInterval(() => {
      const buf = mic.read();
      if (rms(buf) < app.minRms()) return;
      const r = detectPitch(buf.subarray(0, 4096), mic.sampleRate);
      if (!r || r.clarity < 0.8) return;
      if (manual === null && r.freq < 75) return;
      const m = manual === null ? nearestString(r.freq) : matchTarget(r.freq, manual);
      if (!m || (manual === null && Math.abs(m.cents) > 150)) return;

      note.textContent = noteName(freqToMidi(r.freq));
      needle.style.left = `${50 + Math.max(-50, Math.min(50, m.cents))}%`;
      const state = tuneState(m.cents);
      status.textContent = `${m.label}: ${MESSAGES[state]}`;

      if (m.index !== lastIndex) okRun = 0;
      lastIndex = m.index;
      okRun = state === 'ok' ? okRun + 1 : 0;
      if (okRun >= 3) {
        tuned.add(m.index);
        strings[m.index].classList.add('done');
      }
      if (tuned.size === 6 && !fired) {
        fired = true;
        onAllTuned?.();
      }
    }, 100);
  });

  return () => {
    stopped = true;
    if (timer !== undefined) window.clearInterval(timer);
  };
}
