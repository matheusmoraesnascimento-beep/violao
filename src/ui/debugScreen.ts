import type { Screen } from '../app';
import { checkChord, chromaStrengths, EXTRA_ABOVE, MISSING_BELOW } from '../audio/chord';
import { CHORDS, chordPcs, getChord } from '../chords';
import { NOTE_NAMES } from '../theory';
import { h } from './dom';

export const debugScreen: Screen = (root, app) => {
  const select = h('select', {}, ...Object.keys(CHORDS).map((id) => h('option', { value: id }, id)));
  const verdict = h('p', {}, '–');
  const bars = h('div');
  root.append(
    h('h1', {}, 'Debug do detector'),
    h('p', { class: 'hint' }, `Limites atuais: ausente < ${MISSING_BELOW}, sobrando > ${EXTRA_ABOVE}. Veja docs/calibracao.md.`),
    select,
    verdict,
    bars,
  );

  let timer: number | undefined;
  let stopped = false;
  void app.ensureMic().then((mic) => {
    if (stopped || !mic) {
      if (!mic) verdict.textContent = 'Sem microfone.';
      return;
    }
    timer = window.setInterval(() => {
      const buf = mic.read();
      const pcs = chordPcs(getChord(select.value));
      const r = checkChord(buf, mic.sampleRate, pcs, app.minRms());
      verdict.textContent = `${r.verdict} · score ${r.score.toFixed(2)} · falta [${r.missing.map((pc) => NOTE_NAMES[pc])}] · sobra [${r.extra.map((pc) => NOTE_NAMES[pc])}]`;
      const s = chromaStrengths(buf, mic.sampleRate);
      bars.replaceChildren(
        ...s.map((v, pc) =>
          h('div', {}, h('small', {}, `${NOTE_NAMES[pc]}${pcs.includes(pc) ? ' *' : ''} ${v.toFixed(2)}`), h('div', { class: 'bar', style: `width:${Math.round(v * 100)}%` })),
        ),
      );
    }, 150);
  });

  return () => {
    stopped = true;
    if (timer !== undefined) window.clearInterval(timer);
  };
};
