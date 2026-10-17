import type { Screen } from '../app';
import { micMessage } from '../app';
import type { Verdict } from '../audio/chord';
import { listenChord } from '../audio/listen';
import { chordPcs, getChord } from '../chords';
import { PLACEMENT_CHORDS, applyPlacement } from '../placement';
import { todayStr } from '../storage';
import { chordCard, h, selfButtons } from './dom';

export const placementScreen: Screen = (root, app) => {
  const results: Record<string, Verdict> = {};
  let i = 0;
  let stopListen = () => {};
  let disposed = false;
  const stage = h('div');
  root.append(h('h1', {}, 'Nivelamento'), h('p', {}, 'Toque cada acorde. Se não lembrar, toque em "Não consegui".'), stage);

  function show(): void {
    stopListen();
    stopListen = () => {};
    if (i >= PLACEMENT_CHORDS.length) {
      applyPlacement(app.progress, results, todayStr());
      app.save();
      app.go('home');
      return;
    }
    const my = i;
    const id = PLACEMENT_CHORDS[my];
    const live = h('p', { class: 'live' }, '');
    const rate = (v: Verdict) => {
      if (i !== my) return;
      results[id] = v;
      i++;
      show();
    };
    stage.replaceChildren(
      h('p', {}, `Acorde ${my + 1} de ${PLACEMENT_CHORDS.length}`),
      chordCard(id),
      live,
      selfButtons(rate),
    );

    void app.ensureMic().then((mic) => {
      if (disposed || i !== my) return;
      if (!mic) {
        live.textContent = micMessage(app);
        return;
      }
      live.textContent = 'Ouvindo… toque o acorde.';
      let okRun = 0;
      stopListen = listenChord(mic, () => chordPcs(getChord(id)), app.minRms(), (r) => {
        okRun = r.verdict === 'ok' ? okRun + 1 : 0;
        if (okRun >= 2) rate('ok');
      });
    });
  }

  show();
  return () => {
    disposed = true;
    stopListen();
  };
};
