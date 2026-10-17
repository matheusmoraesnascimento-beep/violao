import type { Screen } from '../app';
import { h } from './dom';

export const libraryScreen: Screen = (root) => {
  root.append(h('h1', {}, 'Biblioteca'));
};
