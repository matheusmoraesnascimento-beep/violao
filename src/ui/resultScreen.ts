import type { Screen } from '../app';
import { PHASES } from '../curriculum';
import { h } from './dom';

const VERDICT_TEXT = { ok: 'Certo', close: 'Quase', miss: 'Ainda não' } as const;

export const resultScreen: Screen = (root, app) => {
  const r = app.lastResult;
  if (!r) {
    app.go('home');
    return;
  }
  const p = app.progress;
  const phase = PHASES[p.phase - 1];
  const reviewed = Object.entries(r.reviewed);

  root.append(
    h(
      'div',
      { 'data-testid': 'result' },
      h('h1', {}, r.partial ? 'Sessão encerrada' : 'Sessão concluída!'),
      h('p', { 'data-testid': 'result-streak' }, `Sequência: ${p.streak} dia(s)`),
      r.changesPerMinute !== null && h('p', {}, `Trocas limpas em 1 minuto: ${r.changesPerMinute}`),
      reviewed.length > 0 &&
        h(
          'section',
          { class: 'card' },
          h('h2', {}, 'Revisão'),
          h('table', {}, ...reviewed.map(([id, v]) => h('tr', {}, h('td', {}, id), h('td', {}, VERDICT_TEXT[v])))),
          h('p', { class: 'hint' }, 'Acordes com "Ainda não" voltam na próxima sessão.'),
        ),
      r.bpmRaised.length > 0 && h('section', { class: 'card' }, h('h2', {}, 'BPM subiu'), ...r.bpmRaised.map((t) => h('p', {}, t))),
      r.advancedPhase
        ? h('section', { class: 'card' }, h('h2', {}, `Fase concluída! Agora: ${phase.title}`), h('p', {}, `Meta: ${phase.goal.description}`))
        : h('p', { class: 'hint' }, `Próxima meta (fase ${phase.id}): ${phase.goal.description}`),
      h('button', { class: 'big', 'data-testid': 'back-home', onclick: () => app.go('home') }, 'Voltar ao início'),
    ),
  );
};
