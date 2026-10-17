import type { Screen } from '../app';
import { h } from './dom';

export const resultScreen: Screen = (root) => {
  root.append(h('h1', {}, 'Resultado'));
};
