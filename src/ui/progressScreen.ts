import type { Screen } from '../app';
import { PHASES, chordsUpTo } from '../curriculum';
import { MASTERED_BOX } from '../scheduler';
import { h } from './dom';

export const progressScreen: Screen = (root, app) => {
  const p = app.progress;
  const chords = chordsUpTo(p.phase);
  const withCpm = p.history.filter((s) => s.changesPerMinute !== null).slice(-14);
  const maxCpm = Math.max(40, ...withCpm.map((s) => s.changesPerMinute!));

  root.append(
    h('h1', {}, 'Progresso'),
    h('p', {}, `Sequência: ${p.streak} dia(s) · Sessões: ${p.history.length}`),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Fases'),
      ...PHASES.map((ph) =>
        h(
          'p',
          {},
          ph.id < p.phase ? '✓ ' : ph.id === p.phase ? '▶ ' : '○ ',
          h('strong', {}, `${ph.id}. ${ph.title}`),
          ` — ${ph.goal.description}`,
        ),
      ),
    ),
    ...(chords.length > 0
      ? [
          h(
            'section',
            { class: 'card' },
            h('h2', {}, 'Acordes'),
            h(
              'div',
              { class: 'row' },
              ...chords.map((id) => {
                const box = p.cards[id]?.box ?? 0;
                return h('span', { class: box >= MASTERED_BOX ? 'chip on' : 'chip' }, `${id}${box >= MASTERED_BOX ? ' ✓' : ''}`);
              }),
            ),
            h('p', { class: 'hint' }, 'Marcado com ✓ = dominado (3 acertos espaçados).'),
          ),
        ]
      : []),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Trocas limpas por minuto'),
      withCpm.length === 0
        ? h('p', { class: 'hint' }, 'Ainda sem dados. Aparecem a partir da fase 2.')
        : h(
            'div',
            {},
            ...withCpm.map((s) =>
              h('div', {}, h('small', {}, `${s.date}: ${s.changesPerMinute}`), h('div', { class: 'bar', style: `width:${Math.round((s.changesPerMinute! / maxCpm) * 100)}%` })),
            ),
          ),
    ),
  );
};
