import type { Verdict } from '../audio/chord';
import { getChord } from '../chords';
import { TIME_SCALE } from '../config';
import { chordDiagramSvg } from './chordDiagram';

type Kid = Node | string | number | null | undefined | false;

/** Cria um elemento. Atributos `onxxx` viram listeners; `html` define innerHTML (só use com SVG nosso). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...kids: Kid[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (v !== false && v !== null && v !== undefined) el.setAttribute(k, String(v));
  }
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'number' ? String(c) : c);
  }
  return el;
}

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Cronômetro regressivo. A duração respeita TIME_SCALE. */
export function countdown(seconds: number, onEnd?: () => void): { el: HTMLElement; stop: () => void } {
  const total = Math.max(1, Math.round(seconds * TIME_SCALE));
  const end = Date.now() + total * 1000;
  const el = h('div', { class: 'timer', 'data-testid': 'timer' }, fmt(total));
  const id = window.setInterval(() => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    el.textContent = fmt(left);
    if (left === 0) {
      window.clearInterval(id);
      onEnd?.();
    }
  }, 200);
  return { el, stop: () => window.clearInterval(id) };
}

export function chordCard(id: string): HTMLElement {
  const def = getChord(id);
  return h('figure', { class: 'chord' }, h('div', { html: chordDiagramSvg(def) }), h('figcaption', {}, def.name));
}

/** Botões de autoavaliação (usados sem microfone ou como alternativa a ele). */
export function selfButtons(onPick: (v: Verdict) => void, labels: [string, string, string] = ['Consegui', 'Quase', 'Não consegui']): HTMLElement {
  return h(
    'div',
    { class: 'row' },
    h('button', { 'data-testid': 'self-ok', onclick: () => onPick('ok') }, labels[0]),
    h('button', { 'data-testid': 'self-close', class: 'secondary', onclick: () => onPick('close') }, labels[1]),
    h('button', { 'data-testid': 'self-miss', class: 'secondary', onclick: () => onPick('miss') }, labels[2]),
  );
}
