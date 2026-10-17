import './style.css';
import { createApp, type Screen } from './app';
import { debugScreen } from './ui/debugScreen';
import { h } from './ui/dom';
import { homeScreen } from './ui/homeScreen';
import { libraryScreen } from './ui/libraryScreen';
import { placementScreen } from './ui/placementScreen';
import { progressScreen } from './ui/progressScreen';
import { resultScreen } from './ui/resultScreen';
import { sessionScreen } from './ui/sessionScreen';
import { settingsScreen } from './ui/settingsScreen';
import { tunerScreen } from './ui/tunerScreen';

const app = createApp();
const root = document.getElementById('app')!;
const nav = document.getElementById('nav')!;

const routes: Record<string, Screen> = {
  home: homeScreen,
  placement: placementScreen,
  tuner: tunerScreen,
  session: sessionScreen,
  result: resultScreen,
  progress: progressScreen,
  library: libraryScreen,
  settings: settingsScreen,
  debug: debugScreen,
};

const links: [string, string][] = [
  ['home', 'Início'],
  ['tuner', 'Afinador'],
  ['progress', 'Progresso'],
  ['library', 'Biblioteca'],
  ['settings', 'Ajustes'],
];

let cleanup: void | (() => void);

function render(): void {
  if (typeof cleanup === 'function') cleanup();
  const name = location.hash.replace(/^#\//, '') || 'home';
  nav.replaceChildren(...links.map(([r, label]) => h('a', { href: '#/' + r, class: r === name ? 'active' : '' }, label)));
  root.replaceChildren();
  try {
    cleanup = (routes[name] ?? homeScreen)(root, app);
  } catch (e) {
    console.error(e);
    cleanup = undefined;
    root.replaceChildren();
    cleanup = homeScreen(root, app);
  }
}

window.addEventListener('hashchange', render);
render();
