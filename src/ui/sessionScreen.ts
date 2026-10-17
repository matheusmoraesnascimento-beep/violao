import type { Screen } from '../app';
import { h } from './dom';

export const sessionScreen: Screen = (root) => {
  root.append(h('h1', {}, 'Sessão'));
};
