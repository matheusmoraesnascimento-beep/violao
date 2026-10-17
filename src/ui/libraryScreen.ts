import type { Screen } from '../app';
import { CHORDS } from '../chords';
import { PATTERNS } from '../curriculum';
import { chordCard, h } from './dom';

export const libraryScreen: Screen = (root) => {
  root.append(
    h('h1', {}, 'Biblioteca'),
    h('h2', {}, 'Acordes'),
    h('div', { class: 'diagrams' }, ...Object.keys(CHORDS).map(chordCard)),
    h('h2', {}, 'Batidas'),
    ...Object.values(PATTERNS).map((pat) =>
      h(
        'section',
        { class: 'card' },
        h('strong', {}, `${pat.name} (${pat.bpm} BPM)`),
        h('div', { class: 'grid' }, ...pat.slots.map((s) => h('span', { class: 'slot' }, s === 'D' ? '↓' : s === 'U' ? '↑' : '·'))),
        h('small', {}, '↓ = para baixo · ↑ = para cima · · = só o balanço da mão'),
      ),
    ),
  );
};
