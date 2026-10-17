import type { Screen } from '../app';
import { h } from './dom';
import { mountTuner } from './tunerView';

export const tunerScreen: Screen = (root, app) => {
  const box = h('div', { class: 'tuner' });
  root.append(h('h1', {}, 'Afinador'), box);
  return mountTuner(box, app, () => {
    app.progress.tunedCount++;
    app.save();
  });
};
