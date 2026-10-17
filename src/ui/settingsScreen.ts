import type { Screen } from '../app';
import { h } from './dom';

export const settingsScreen: Screen = (root) => {
  root.append(h('h1', {}, 'Ajustes'));
};
