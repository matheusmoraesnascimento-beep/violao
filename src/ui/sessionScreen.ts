import type { App, Screen, SessionResult } from '../app';
import { micMessage } from '../app';
import { ChangeCounter } from '../audio/changeCounter';
import type { Verdict } from '../audio/chord';
import { listenChord } from '../audio/listen';
import { Metronome } from '../audio/metronome';
import { chordPcs, getChord } from '../chords';
import { PATTERNS } from '../curriculum';
import { advancePhase, changesVerdict, recordApply, reviewCard } from '../scheduler';
import { buildSession, type Block } from '../session';
import { todayStr, updateStreak } from '../storage';
import { NOTE_NAMES } from '../theory';
import { chordCard, countdown, h, selfButtons } from './dom';
import { mountTuner } from './tunerView';

type Renderer = (box: HTMLElement, app: App, b: Block, next: () => void, result: SessionResult) => () => void;

/** Ignora o microfone logo após mostrar um acorde, para o som do anterior não valer. */
const COOLDOWN_MS = 800;

const VERDICT_TEXT: Record<Verdict, string> = { ok: 'Certo!', close: 'Quase lá', miss: 'Ainda não' };

function liveText(v: Verdict, missing: number[]): string {
  const hint = missing.length ? ` — falta soar: ${missing.map((pc) => NOTE_NAMES[pc]).join(', ')}` : '';
  return VERDICT_TEXT[v] + hint;
}

const tuneBlock: Renderer = (box, app, _b, next) => {
  let all = false;
  const stop = mountTuner(box, app, () => {
    all = true;
  });
  box.append(
    h(
      'button',
      {
        'data-testid': 'next',
        onclick: () => {
          if (all || !app.mic) app.progress.tunedCount++;
          next();
        },
      },
      'Afinado, continuar',
    ),
  );
  return stop;
};

const textBlock: Renderer = (box, _app, b, next) => {
  const t = countdown(b.minutes * 60);
  box.append(h('p', { class: 'instr' }, b.instruction), t.el, h('button', { 'data-testid': 'next', onclick: next }, 'Pronto'));
  return t.stop;
};

const changesBlock: Renderer = (box, app, b, next, result) => {
  const [a, c] = b.pair!;
  const counter = new ChangeCounter([a, c]);
  const countEl = h('div', { class: 'count', 'data-testid': 'count' }, '0');
  const targetEl = h('p', { class: 'instr' }, '');
  const liveEl = h('p', { class: 'live' }, '');
  const timerBox = h('div');
  const actions = h('div', { class: 'row' });
  let stopListen = () => {};
  let timer: { stop: () => void } | null = null;
  let disposed = false;

  const refresh = () => {
    countEl.textContent = String(counter.count);
    targetEl.textContent = `Toque agora: ${counter.target}`;
  };

  const finishTimer = () => {
    stopListen();
    result.changesPerMinute = counter.count;
    app.progress.bestChangesPerMinute = Math.max(app.progress.bestChangesPerMinute, counter.count);
    const verdict = changesVerdict(counter.count);
    for (const id of [a, c]) {
      reviewCard(app.progress, id, verdict, todayStr());
      result.reviewed[id] = verdict;
    }
    actions.replaceChildren(
      h('p', {}, `${counter.count} trocas limpas em 1 minuto.`),
      h('button', { 'data-testid': 'next', onclick: next }, 'Continuar'),
    );
  };

  const start = async () => {
    actions.replaceChildren(h('p', { class: 'live' }, 'Preparando microfone…'));
    const mic = await app.ensureMic();
    if (disposed) return;
    refresh();
    const t = countdown(60, finishTimer);
    timer = t;
    timerBox.replaceChildren(t.el);
    actions.replaceChildren(
      h('button', { 'data-testid': 'count-change', onclick: () => { counter.manual(); refresh(); } }, '+1 troca limpa (manual)'),
      h('button', { class: 'ghost', 'data-testid': 'skip', onclick: next }, 'Pular'),
    );
    if (!mic) {
      liveEl.textContent = micMessage(app) + ' Conte cada troca bem feita no botão.';
      return;
    }
    stopListen = listenChord(mic, () => chordPcs(getChord(counter.target)), app.minRms(), (r) => {
      liveEl.textContent = liveText(r.verdict, r.missing);
      if (counter.feed(r.verdict)) refresh();
    });
  };

  box.append(
    h('p', { class: 'instr' }, b.instruction),
    h('div', { class: 'diagrams' }, chordCard(a), chordCard(c)),
    timerBox,
    countEl,
    targetEl,
    liveEl,
    actions,
  );
  actions.append(h('button', { 'data-testid': 'start-timer', onclick: () => void start() }, 'Começar 1 minuto'));

  return () => {
    disposed = true;
    timer?.stop();
    stopListen();
  };
};

const applyBlock: Renderer = (box, app, b, next, result) => {
  const pat = PATTERNS[b.patternId!];
  const chords = b.chordIds ?? [];
  const slots = pat.slots.map((s) => h('span', { class: 'slot' }, s === 'D' ? '↓' : s === 'U' ? '↑' : '·'));
  const chips = chords.map((id) => h('span', { class: 'chip' }, id));
  const metro = new Metronome((beat) => {
    slots.forEach((s) => s.classList.remove('on'));
    slots[(beat % 4) * 2].classList.add('on');
    chips.forEach((c) => c.classList.remove('on'));
    if (chips.length) chips[Math.floor(beat / 4) % chips.length].classList.add('on');
  });
  const metroBtn = h('button', {
    'data-testid': 'metro',
    onclick: () => {
      if (metro.running) {
        metro.stop();
        metroBtn.textContent = 'Ligar metrônomo';
      } else {
        void metro.start(b.bpm!);
        metroBtn.textContent = 'Parar metrônomo';
      }
    },
  }, 'Ligar metrônomo');
  const t = countdown(b.minutes * 60);

  const rate = (v: Verdict) => {
    metro.stop();
    const r = recordApply(app.progress, b.bpmKey!, b.bpm!, v, !!b.isSong);
    if (r.raised) result.bpmRaised.push(`${b.title}: ${r.bpm} BPM`);
    next();
  };

  box.append(
    h('p', { class: 'instr' }, b.instruction),
    h('p', {}, h('strong', {}, String(b.bpm)), ' BPM'),
    h('div', { class: 'chords-row' }, ...chords.map(chordCard)),
    h('div', { class: 'row' }, ...chips),
    h('div', { class: 'grid' }, ...slots),
    metroBtn,
    t.el,
    h('p', {}, 'Como foi? (3 acertos seguidos com "Consegui" sobem o BPM)'),
    selfButtons(rate),
  );
  return () => {
    metro.stop();
    t.stop();
  };
};

const reviewBlock: Renderer = (box, app, b, next, result) => {
  const ids = b.chordIds!;
  const today = todayStr();
  const stage = h('div');
  let i = 0;
  let stopListen = () => {};
  let disposed = false;
  box.append(stage);

  const show = () => {
    stopListen();
    stopListen = () => {};
    if (i >= ids.length) {
      next();
      return;
    }
    const my = i;
    const id = ids[my];
    const live = h('p', { class: 'live' }, '');
    const shownAt = Date.now();
    const rate = (v: Verdict) => {
      if (i !== my) return;
      reviewCard(app.progress, id, v, today);
      result.reviewed[id] = v;
      i++;
      show();
    };
    stage.replaceChildren(h('p', { class: 'instr' }, `Toque ${getChord(id).name} uma vez, devagar.`), chordCard(id), live, selfButtons(rate));

    void app.ensureMic().then((mic) => {
      if (disposed || i !== my) return;
      if (!mic) {
        live.textContent = micMessage(app);
        return;
      }
      let okRun = 0;
      stopListen = listenChord(mic, () => chordPcs(getChord(id)), app.minRms(), (r) => {
        if (Date.now() < shownAt + COOLDOWN_MS) return;
        live.textContent = liveText(r.verdict, r.missing);
        okRun = r.verdict === 'ok' ? okRun + 1 : 0;
        if (okRun >= 2) rate('ok');
      });
    });
  };
  show();
  return () => {
    disposed = true;
    stopListen();
  };
};

const RENDERERS: Record<Block['kind'], Renderer> = {
  tune: tuneBlock,
  warmup: textBlock,
  technique: textBlock,
  changes: changesBlock,
  apply: applyBlock,
  review: reviewBlock,
};

export const sessionScreen: Screen = (root, app) => {
  const today = todayStr();
  const blocks = buildSession(app.progress, today);
  const result: SessionResult = {
    date: today,
    changesPerMinute: null,
    reviewed: {},
    bpmRaised: [],
    partial: false,
    minutes: 0,
    advancedPhase: false,
  };
  const startedAt = Date.now();
  let idx = 0;
  let stopBlock = () => {};
  let ended = false;
  let stopRetune: (() => void) | null = null;

  const title = h('h1', {}, '');
  const stage = h('div', { class: 'stage' });
  const tunerBox = h('div');
  const retune = h('details', { class: 'retune' }, h('summary', {}, 'Reafinar'), tunerBox);
  retune.addEventListener('toggle', () => {
    if (retune.open) {
      stopRetune = mountTuner(tunerBox, app);
    } else {
      stopRetune?.();
      stopRetune = null;
      tunerBox.replaceChildren();
    }
  });

  root.append(
    title,
    ...(app.progress.history.length < 14 ? [h('p', { class: 'hint' }, 'Dedos doendo é normal nas 2 primeiras semanas. Pare se a dor for forte.')] : []),
    stage,
    retune,
    h('button', { class: 'ghost', 'data-testid': 'end-early', onclick: () => finish(true) }, 'Dedos doendo? Encerrar agora'),
  );

  function show(): void {
    stopBlock();
    stage.replaceChildren();
    if (idx >= blocks.length) {
      finish(false);
      return;
    }
    const b = blocks[idx];
    title.textContent = `${idx + 1}/${blocks.length} · ${b.title} (${b.minutes} min)`;
    stopBlock = RENDERERS[b.kind](stage, app, b, () => {
      idx++;
      app.save();
      show();
    }, result);
  }

  function finish(partial: boolean): void {
    if (ended) return;
    ended = true;
    stopBlock();
    stopRetune?.();
    const p = app.progress;
    updateStreak(p, today);
    p.sessionsInPhase++;
    result.partial = partial;
    result.minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    p.history.push({ date: today, changesPerMinute: result.changesPerMinute, minutes: result.minutes, partial });
    p.history = p.history.slice(-60);
    result.advancedPhase = advancePhase(p, today);
    app.lastResult = result;
    app.save();
    app.go('result');
  }

  show();
  return () => {
    stopBlock();
    stopRetune?.();
    app.save();
  };
};
