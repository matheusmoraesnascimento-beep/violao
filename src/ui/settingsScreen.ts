import type { Screen } from '../app';
import { ensureCards } from '../scheduler';
import { defaultProgress, parseProgress, todayStr } from '../storage';
import { h } from './dom';

export const settingsScreen: Screen = (root, app) => {
  const s = app.progress.settings;

  const micToggle = h('input', { type: 'checkbox', ...(s.micEnabled ? { checked: 'checked' } : {}) });
  micToggle.checked = s.micEnabled;
  micToggle.addEventListener('change', () => {
    s.micEnabled = micToggle.checked;
    app.save();
  });

  const sens = h('input', { type: 'range', min: '0.5', max: '2', step: '0.1', value: String(s.sensitivity) });
  sens.addEventListener('change', () => {
    s.sensitivity = Number(sens.value);
    app.save();
  });

  const fileInput = h('input', { type: 'file', accept: 'application/json' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const imported = parseProgress(await file.text());
      ensureCards(imported, todayStr());
      Object.assign(app.progress, imported);
      app.save();
      alert('Progresso importado.');
      app.go('home');
    } catch {
      alert('Arquivo inválido. O progresso atual foi mantido.');
    }
  });

  root.append(
    h('h1', {}, 'Ajustes'),
    h('label', { class: 'card' }, micToggle, ' Usar o microfone para ouvir o violão'),
    h('label', { class: 'card' }, 'Sensibilidade do microfone: ', sens, h('small', { class: 'hint' }, ' Aumente se o app não ouve; diminua se há muito ruído.')),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Backup'),
      h(
        'button',
        {
          onclick: () => {
            const blob = new Blob([JSON.stringify(app.progress, null, 2)], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: 'violao-progresso.json' });
            a.click();
            URL.revokeObjectURL(a.href);
          },
        },
        'Exportar progresso',
      ),
      h('p', {}, 'Importar: ', fileInput),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', {}, 'Apagar dados'),
      h(
        'button',
        {
          class: 'secondary',
          onclick: () => {
            if (!confirm('Apagar todo o progresso? Isso não pode ser desfeito.')) return;
            Object.assign(app.progress, defaultProgress());
            app.save();
            app.go('home');
          },
        },
        'Apagar progresso',
      ),
    ),
  );
};
