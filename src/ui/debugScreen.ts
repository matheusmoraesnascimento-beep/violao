import type { Screen } from '../app';
import { h } from './dom';

export const debugScreen: Screen = (root) => {
  root.append(h('h1', {}, 'Debug'));
};
