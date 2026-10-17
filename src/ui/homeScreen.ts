import type { Screen } from '../app';
import { PHASES } from '../curriculum';
import { todayStr } from '../storage';
import { h } from './dom';

export const homeScreen: Screen = (root, app) => {
  const p = app.progress;
  const phase = PHASES[p.phase - 1];
  const practicedToday = p.lastPracticeDay === todayStr();
  const hasAudio = !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

  root.append(
    h('h1', {}, 'Violão'),
    ...(hasAudio ? [] : [h('p', { class: 'warn' }, 'Seu navegador não suporta áudio avançado. Use Chrome, Edge ou Safari atualizado.')]),
    h('p', { 'data-testid': 'streak' }, `Sequência: ${p.streak} dia(s)`),
    ...(p.placementDone && !practicedToday ? [h('p', { class: 'hint' }, 'Você ainda não praticou hoje.')] : []),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, `Fase ${phase.id}: ${phase.title}`),
      h('p', {}, phase.summary),
      h('p', {}, `Meta: ${phase.goal.description}`),
    ),
    p.placementDone
      ? h('button', { class: 'big', 'data-testid': 'start', onclick: () => app.go('session') }, practicedToday ? 'Praticar de novo' : 'Começar sessão de hoje')
      : h('button', { class: 'big', 'data-testid': 'placement', onclick: () => app.go('placement') }, 'Fazer nivelamento (5 min)'),
  );
};
