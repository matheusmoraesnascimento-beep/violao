import type { Screen } from '../app';
import { h } from './dom';

export const progressScreen: Screen = (root) => {
  root.append(h('h1', {}, 'Progresso'));
};
